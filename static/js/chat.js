// Se crea una conexión con el servidor
        const socket = io({
            reconnection: true,  // Habilita la reconexión automática
            reconnectionAttempts: 5,  // Número de intentos de reconexión
            reconnectionDelay: 1000,  // Tiempo entre intentos en milisegundos
        }); 

        let username = '';  // Variable para almacenar el nombre de usuario
        let currentRoom = null;  // Variable para almacenar la sala actual
        let typingTimeout = null;  // Temporizador para el indicador de "escribiendo..."
        
        // Variables para manejo de captura de medios
        let mediaRecorder = null;  // Grabador de audio/video
        let recordedChunks = [];  // Fragmentos de audio/video grabados
        let cameraStream = null;  // Stream de la cámara para fotos
        let videoStream = null;  // Stream de video para grabación

        // Lista de emojis disponibles en el selector
        const emojis = ['😊', '😂', '❤️', '👍', '🔥', '🎉', '😍', '🚀', '💯', '🤔', '😎', '🥳', '😢', '😭', '😡', '💪', '🙏', '✨'];

        // Función helper para formatear tamaño de archivo
        function formatFileSize(bytes) {
            if (!bytes || bytes === 0) return 'Desconocido';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
        }

        // Función para detectar si es archivo de código
        function isCodeFile(fileName) {
            const codeExts = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'cs', 'rb', 'go', 'php', 'html', 'css', 'json', 'xml', 'yml', 'sh', 'sql'];
            const ext = fileName.split('.').pop().toLowerCase();
            return codeExts.includes(ext);
        }

        // Generar botones de emojis dinámicamente
        emojis.forEach(emoji => {
            $('#emojiList').append(`<button class="btn btn-light emoji-item" style="font-size: 1.5em;">${emoji}</button>`);
        });

        // Función para formatear el timestamp (marca de tiempo) de manera legible
        // Convierte "2026-02-13T14:30:45.123456" a "14:30:45"
        function formatTimestamp(isoString) {
            const date = new Date(isoString);  // Crea un objeto Date desde el string ISO
            const hours = date.getHours().toString().padStart(2, '0');  // Obtiene las horas (formato 24h)
            const minutes = date.getMinutes().toString().padStart(2, '0');  // Obtiene los minutos
            const seconds = date.getSeconds().toString().padStart(2, '0');  // Obtiene los segundos
            return `${hours}:${minutes}:${seconds}`;  // Retorna en formato HH:MM:SS
        }

        // Función para detectar si un texto es solo un emoji
        function isEmoji(str) {
            // Regex para detectar emojis
            const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base})+$/u;
            return emojiRegex.test(str.trim());
        }

        // Evento para establecer el nombre de usuario
        $('#setUsername').on('click', function() {
            const inputUsername = $('#username').val().trim();
            if (inputUsername.length > 0) {
                username = inputUsername;
                $('#username').prop('disabled', true);
                $('#setUsername').prop('disabled', true);
                alert(`Nombre de usuario establecido: ${username}`);
            } else {
                alert("El nombre de usuario no puede estar vacío.");
            }
        });

        // Evento para establecer el nombre de usuario al presionar Enter
        $('#username').on('keypress', function(e) {
            if (e.key === 'Enter') {
                $('#setUsername').click();
            }
        });

        // Evento para unirse a una sala
        $('#joinRoom').on('click', function() {
            const roomName = $('#roomName').val().trim();
            
            // Validaciones
            if (!username) {
                alert("Debes establecer un nombre de usuario antes de unirte a una sala.");
                return;
            }
            if (roomName.length === 0) {
                alert("El nombre de la sala no puede estar vacío.");
                return;
            }
            if (currentRoom) {
                alert("Ya estás en una sala. Sal primero antes de unirte a otra.");
                return;
            }

            // Guarda la sala actual
            currentRoom = roomName;
            
            // Emite el evento al servidor
            socket.emit("join_room", { room: roomName, username });
            
            // Actualiza la interfaz
            $('#currentRoomInfo').show();
            $('#currentRoomName').text(roomName);
            $('#messages').append(`<li class="list-group-item text-muted text-center"><small>✓ Te has unido a la sala: ${roomName}</small></li>`);
            $('#messages').scrollTop($('#messages')[0].scrollHeight);
        });

        // Evento para salir de una sala
        $('#leaveRoom').on('click', function() {
            if (!currentRoom) {
                alert("No estás en ninguna sala.");
                return;
            }

            // Emite el evento al servidor
            socket.emit("leave_room", { room: currentRoom, username });
            
            // Actualiza la interfaz
            $('#messages').append(`<li class="list-group-item text-muted text-center"><small>← Has salido de la sala: ${currentRoom}</small></li>`);
            $('#messages').scrollTop($('#messages')[0].scrollHeight);
            currentRoom = null;
            $('#currentRoomInfo').hide();
            $('#usersList').empty();
        });

        // Mostrar/ocultar el panel de emojis
        $('#emojiBtn').on('click', function() {
            $('#emojiPicker').toggle();
        });

        // Boton unico para adjuntar (foto, video, audio, archivos)
        $('#clipBtn').on('click', function() {
            $('#clipInput').click();
        });

        // Evento cuando el usuario selecciona un archivo
        $('#clipInput').on('change', function(event) {
            const file = event.target.files[0];

            if (!username || !currentRoom) {
                alert("Debes establecer un usuario y unirte a una sala primero.");
                return;
            }

            if (!file) return;

            const fileNameLower = (file.name || '').toLowerCase();
            const isImage = file.type.startsWith('image/') || fileNameLower.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/);
            const isVideo = file.type.startsWith('video/') || fileNameLower.match(/\.(mp4|mov|webm|mkv|avi)$/);
            const isAudio = file.type.startsWith('audio/') || fileNameLower.match(/\.(mp3|wav|ogg|m4a|aac)$/);
            const isPDF = file.type === 'application/pdf' || fileNameLower.match(/\.pdf$/);
            const isOffice = fileNameLower.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/);

            let maxSize = 50 * 1024 * 1024; // 50MB por defecto
            if (isImage) {
                maxSize = 25 * 1024 * 1024; // 25MB imagen
            } else if (isVideo) {
                maxSize = 100 * 1024 * 1024; // 100MB video
            } else if (isAudio) {
                maxSize = 30 * 1024 * 1024; // 30MB audio
            }

            if (file.size > maxSize) {
                alert(`El archivo es demasiado grande. Maximo ${Math.round(maxSize / (1024 * 1024))}MB.`);
                return;
            }

            let mediaType = 'raw';
            let msgType = 'file';

            if (isImage) {
                mediaType = 'image';
                msgType = 'image';
            } else if (isVideo) {
                mediaType = 'video';
                msgType = 'video';
            } else if (isAudio) {
                mediaType = 'audio';
                msgType = 'audio';
            } else if (isPDF || isOffice) {
                mediaType = 'raw';
                msgType = 'file';
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('media_type', mediaType);
            formData.append('room', currentRoom);
            formData.append('username', username);

            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const content = msgType === 'file' || msgType === 'audio'
                        ? { url: data.url, filename: file.name, size: file.size }
                        : data.url;

                    socket.emit('message', {
                        username,
                        type: msgType,
                        content: content,
                        room: currentRoom
                    });
                } else {
                    alert("Error al subir archivo: " + data.error);
                }
            })
            .catch(error => {
                console.error("Error:", error);
                alert("Error al subir archivo");
            });

            $('#clipInput').val('');
        });
        
        // Insertar emoji al hacer clic
        $(document).on('click', '.emoji-item', function() {
            const emoji = $(this).text();
            $('#myMessage').val($('#myMessage').val() + emoji);
            $('#emojiPicker').hide();
            $('#myMessage').focus();
        });

        // Cerrar el panel de emojis al hacer clic fuera
        $(document).on('click', function(e) {
            if (!$(e.target).closest('#emojiBtn, #emojiPicker').length) {
                $('#emojiPicker').hide();
            }
        });

        // El navegador escucha los mensajes que el servidor envía
        socket.on("message", function(msg) {
            if (typeof msg === 'string') {
                // Mensaje de sistema
                $('#messages').append(`<li class="list-group-item text-muted text-center"><small>${msg}</small></li>`);
            } else {
                // Mensaje de usuario
                const time = formatTimestamp(msg.timestamp);
                const isOwn = msg.username === username;
                const ownAttr = isOwn ? 'true' : 'false';
                
                if (msg.type === "emoji") {
                    $('#messages').append(`
                        <li class="list-group-item" data-own="${ownAttr}">
                            ${!isOwn ? `<strong>${msg.username}</strong>` : ''}
                            <div class="message-bubble">
                                <span style="font-size: 2.5em;">${msg.content}</span>
                            </div>
                            <small>${time}</small>
                        </li>
                    `);
                } else if (msg.type === "image") {
                    $('#messages').append(`
                        <li class="list-group-item" data-own="${ownAttr}">
                            ${!isOwn ? `<strong>${msg.username}</strong>` : ''}
                            <div class="message-bubble">
                                <img src="${msg.content}" style="max-width: 250px; border-radius: 8px;" alt="Imagen">
                            </div>
                            <small>${time}</small>
                        </li>
                    `);
                } else if (msg.type === "audio") {
                    const fileUrl = msg.content && msg.content.url ? msg.content.url : msg.content;
                    const fileName = msg.content && msg.content.filename ? msg.content.filename : 'Audio';
                    $('#messages').append(`
                        <li class="list-group-item" data-own="${ownAttr}">
                            ${!isOwn ? `<strong>${msg.username}</strong>` : ''}
                            <div class="message-bubble">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <span>🎤</span>
                                    <span style="font-size: 0.9em; word-break: break-word;">${fileName}</span>
                                </div>
                                <audio controls style="width: 100%; max-width: 300px; margin-top: 8px; display: block;">
                                    <source src="${fileUrl}" type="audio/mpeg">
                                    <source src="${fileUrl}" type="audio/webm">
                                    <source src="${fileUrl}" type="audio/wav">
                                    Tu navegador no soporta audio HTML5.
                                </audio>
                            </div>
                            <small>${time}</small>
                        </li>
                    `);
                } else if (msg.type === "video") {
                    // Mensaje de video con reproductor HTML5
                    $('#messages').append(`
                        <li class="list-group-item" data-own="${ownAttr}">
                            ${!isOwn ? `<strong>${msg.username}</strong>` : ''}
                            <div class="message-bubble">
                                <video controls style="max-width: 250px; border-radius: 8px; margin-top: 5px;">
                                    <source src="${msg.content}" type="video/webm">
                                    Tu navegador no soporta video HTML5.
                                </video>
                            </div>
                            <small>${time}</small>
                        </li>
                    `);
                } else if (msg.type === "file") {
                    const fileUrl = msg.content && msg.content.url ? msg.content.url : msg.content;
                    const fileName = msg.content && msg.content.filename ? msg.content.filename : 'Archivo';
                    const fileExt = fileName.split('.').pop().toLowerCase();
                    
                    let embedContent = '';
                    let icon = '📎';
                    let fileSize = msg.content.size ? formatFileSize(msg.content.size) : 'Desconocido';
                    
                    // Crear tabla de detalles
                    let detailsTable = `
                        <table class="table table-sm table-bordered" style="margin-top: 8px; font-size: 0.85em;">
                            <tr><td><strong>Tipo:</strong></td><td>${fileExt.toUpperCase()}</td></tr>
                            <tr><td><strong>Tamaño:</strong></td><td>${fileSize}</td></tr>
                        </table>
                    `;
                    
                    // PDF: usar embed directo  (funciona mejor que Google Docs Viewer)
                    if (fileExt === 'pdf') {
                        icon = '📄';
                        const downloadUrl = `/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName)}`;
                        embedContent = `${detailsTable}<embed src="${fileUrl}" type="application/pdf" style="width: 100%; height: 400px; border-radius: 8px; margin-top: 8px; border: 1px solid #ddd;" /><div style="margin-top: 8px; font-size: 0.85em; color: #666;">Si el PDF no carga, <a href="${downloadUrl}">descargar aquí</a></div>`;
                    }
                    // Office documents: mostrar con opciones mejoradas
                    else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExt)) {
                        if (fileExt === 'doc' || fileExt === 'docx') {
                            icon = '📝';
                        } else if (fileExt === 'xls' || fileExt === 'xlsx') {
                            icon = '📊';
                        } else if (fileExt === 'ppt' || fileExt === 'pptx') {
                            icon = '🎯';
                        }
                        const onlinePath = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
                        const downloadUrl = `/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName)}`;
                        embedContent = `${detailsTable}<div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-top: 8px;"><p style="margin: 0; font-size: 0.9em;">📋 Documentos Office requieren:</p><ul style="margin: 8px 0 0 20px; padding: 0;"><li><a href="${downloadUrl}">Descargar</a> para usar localmente</li><li><a href="${onlinePath}" target="_blank" rel="noopener noreferrer" style="color: #0d6efd;">Ver Online</a> (puede requerir permisos)</li></ul></div>`;
                    }
                    // Archivos de codigo: mostrar con Highlight.js
                    else if (isCodeFile(fileName)) {
                        icon = '💻';
                        const downloadUrl = `/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName)}`;
                        embedContent = `${detailsTable}<div style="background: #282c34; color: #abb2bf; padding: 12px; border-radius: 6px; margin-top: 8px; max-height: 250px; overflow-y: auto; font-size: 0.85em;"><p style="margin: 0 0 8px 0;">Descarga el archivo para ver el código con sintaxis coloreada:</p></div><a href="${downloadUrl}" style="display: inline-block; padding: 8px 12px; background: #0d6efd; color: white; border-radius: 6px; text-decoration: none; margin-top: 8px; font-size: 0.9em;">📖 Ver/Descargar</a>`;
                    }
                    // Otros archivos: mostrar como descarga con tabla de detalles
                    else {
                        const downloadUrl = `/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName)}`;
                        embedContent = `${detailsTable}<a href="${downloadUrl}" style="display: inline-block; padding: 8px 12px; background: #0d6efd; color: white; border-radius: 6px; text-decoration: none; margin-top: 8px; font-size: 0.9em;">⬇ Descargar ${fileName}</a>`;
                    }
                    
                    $('#messages').append(`
                        <li class="list-group-item" data-own="${ownAttr}" style="cursor: pointer;">
                            ${!isOwn ? `<strong>${msg.username}</strong>` : ''}
                            <div class="message-bubble">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <span>${icon}</span>
                                    <span style="font-size: 0.9em; word-break: break-word; flex: 1;">${fileName}</span>
                                    <small style="opacity: 0.7;">📌</small>
                                </div>
                                ${embedContent}
                            </div>
                            <small>${time}</small>
                        </li>
                    `);
                } else {
                    $('#messages').append(`
                        <li class="list-group-item" data-own="${ownAttr}">
                            ${!isOwn ? `<strong>${msg.username}</strong>` : ''}
                            <div class="message-bubble">${msg.content}</div>
                            <small>${time}</small>
                        </li>
                    `);
                }
            }
            $('#messages').scrollTop($('#messages')[0].scrollHeight);
        });

        // Manejador de clic en archivos para expandir en modal
        $(document).on('click', 'li.list-group-item[style*="cursor"]', function(e) {
            if ($(e.target).closest('a, button, table').length) return; // No expandir si hace clic en link o botón
            
            const fileExt = $(this).find('.message-bubble strong, span').text().toLowerCase();
            
            // Si puede contener preview, expandir en modal
            if (fileExt.includes('.pdf') || fileExt.match(/\.(doc|docx|xls|xlsx|ppt|pptx|js|ts|py|java|cpp|c|cs|rb|go|php|html|css|json|xml)$/i)) {
                const bubble = $(this).find('.message-bubble');
                const title = $(this).find('strong, span').first().text();
                const downloadLink = $(this).find('a[href*="http"]').attr('href');
                
                $('#fileModalTitle').text('📎 ' + title);
                $('#fileModalContent').html(bubble.html());
                $('#fileModalDownload').attr('href', downloadLink);
                
                const modal = new bootstrap.Modal(document.getElementById('fileModal'));
                modal.show();
            }
        });

        // Evento cuando el usuario está escribiendo
        $('#myMessage').on('input', function() {
            if (currentRoom && username) {
                socket.emit('typing', {
                    username: username,
                    room: currentRoom,
                    is_typing: true
                });
                
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(function() {
                    socket.emit('typing', {
                        username: username,
                        room: currentRoom,
                        is_typing: false
                    });
                }, 2000);
            }
        });

        // Evento para enviar mensajes al presionar Enter
        $('#myMessage').on('keypress', function(e) {
            if (e.key === 'Enter') {
                $('#send').click();
                if (currentRoom && username) {
                    clearTimeout(typingTimeout);
                    socket.emit('typing', {
                        username: username,
                        room: currentRoom,
                        is_typing: false
                    });
                }
            }
        });

        // Evento para enviar mensajes
        $('#send').on('click', function() { 
            const message = $('#myMessage').val().trim();
            
            // Validaciones
            if (!username) {
                alert("Debes establecer un nombre de usuario antes de enviar mensajes.");
                return;
            }
            if (!currentRoom) {
                alert("Debes unirte a una sala antes de enviar mensajes.");
                return;
            }
            if (message.length === 0) {
                alert("El mensaje no puede estar vacío.");
                return;
            }
            if (message.length > 1000) {
                alert("El mensaje no puede exceder los 1000 caracteres.");
                return;
            }

            // Notifica que dejó de escribir
            clearTimeout(typingTimeout);
            socket.emit('typing', {
                username: username,
                room: currentRoom,
                is_typing: false
            });

            // Envía el mensaje
            if (isEmoji(message)) {
                socket.emit("message", { 
                    username, 
                    type: "emoji", 
                    content: message,
                    room: currentRoom
                });
            } else {
                socket.emit("message", { 
                    username, 
                    type: "text", 
                    content: message,
                    room: currentRoom
                });
            }
            
            $('#myMessage').val('');
        });

        // Evento para recibir actualizaciones de la lista de usuarios
        socket.on('update_user_list', function(data) {
            const users = data.users;
            $('#usersList').empty();
            users.forEach(function(user) {
                $('#usersList').append(`<li>${user}</li>`);
            });
        });

        // Evento para mostrar el indicador "está escribiendo..."
        socket.on('user_typing', function(data) {
            const typingUser = data.username;
            const isTyping = data.is_typing;
            
            if (isTyping) {
                $('#typingIndicator').text(`${typingUser} está escribiendo...`).show();
            } else {
                $('#typingIndicator').hide();
            }
        });

        // Manejo de errores de conexión
        socket.on("connect_error", () => {
            alert("No se pudo conectar al servidor. Verifica tu conexión.");
        });

        socket.on("disconnect", () => {
            $('#messages').append(`<li class="list-group-item text-muted text-center"><small>⚠ Desconectado. Intentando reconectar...</small></li>`);
            $('#messages').scrollTop($('#messages')[0].scrollHeight);
        });

        socket.on("connect", () => {
            $('#messages').append(`<li class="list-group-item text-muted text-center"><small>✓ Conectado al servidor</small></li>`);
            $('#messages').scrollTop($('#messages')[0].scrollHeight);
        });