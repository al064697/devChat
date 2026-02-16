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

        // Evento para abrir el selector de imágenes
        $('#imageBtn').on('click', function() {
            $('#imageInput').click();
        });

        // Evento cuando el usuario selecciona una imagen
        $('#imageInput').on('change', function(event) {
            const file = event.target.files[0];
            
            // Validaciones
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                alert("Por favor selecciona un archivo de imagen válido.");
                return;
            }
            const maxSize = 25 * 1024 * 1024; // 25MB (Full HD)
            if (file.size > maxSize) {
                alert("La imagen es demasiado grande. Máximo 25MB.");
                return;
            }

            // FormData para enviar la imagen al servidor
            const formData = new FormData();
            formData.append('file', file);
            formData.append('media_type', 'image');
            formData.append('room', currentRoom);
            formData.append('username', username);

            // Envía la imagen al endpoint /upload
            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Envía el mensaje con la URL de Cloudinary
                    socket.emit("message", { 
                        username,
                        type: "image",
                        content: data.url,  // URL de Cloudinary en lugar de base64
                        room: currentRoom
                    });
                } else {
                    alert("Error al subir imagen: " + data.error);
                }
            })
            .catch(error => {
                console.error("Error:", error);
                alert("Error al subir imagen");
            });

            $('#imageInput').val('');
        });

        // ===== FUNCIONES PARA CAPTURA DE FOTO CON CÁMARA =====
        
        // Abrir modal de cámara para tomar foto
        $('#cameraBtn').on('click', async function() {
            if (!username || !currentRoom) {
                alert("Debes establecer un usuario y unirte a una sala primero.");
                return;
            }
            
            try {
                // Solicita acceso a la cámara (video sin audio)
                cameraStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 1920, height: 1080 },  // Resolución Full HD 1080p
                    audio: false 
                });
                
                // Conecta el stream al elemento video
                $('#cameraStream')[0].srcObject = cameraStream;
                $('#cameraModal').show();
            } catch (err) {
                console.error('Error al acceder a la cámara:', err);
                alert('No se pudo acceder a la cámara. Verifica los permisos.');
            }
        });
        
        // Capturar foto desde el stream de video
        $('#capturePhoto').on('click', function() {
            const video = $('#cameraStream')[0];
            const canvas = $('#cameraCanvas')[0];
            
            // Ajusta el tamaño del canvas al tamaño del video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Dibuja el frame actual del video en el canvas
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convierte el canvas a Blob
            canvas.toBlob(function(blob) {
                // FormData para subir la foto
                const formData = new FormData();
                formData.append('file', blob, 'photo.jpg');
                formData.append('media_type', 'image');
                formData.append('room', currentRoom);
                formData.append('username', username);

                fetch('/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        socket.emit('message', {
                            username,
                            type: 'image',
                            content: data.url,
                            room: currentRoom
                        });
                    } else {
                        alert("Error al subir foto: " + data.error);
                    }
                })
                .catch(error => {
                    console.error("Error:", error);
                    alert("Error al subir foto");
                });
            }, 'image/jpeg', 0.85);
            
            // Cierra el modal y detiene la cámara
            closeCameraModal();
        });
        
        // Cerrar modal de cámara
        $('#closeCameraModal').on('click', closeCameraModal);
        
        function closeCameraModal() {
            if (cameraStream) {
                // Detiene todos los tracks del stream
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            $('#cameraModal').hide();
        }
        
        // ===== FUNCIONES PARA GRABACIÓN DE AUDIO =====
        
        // Iniciar grabación de audio
        $('#audioBtn').on('click', async function() {
            if (!username || !currentRoom) {
                alert("Debes establecer un usuario y unirte a una sala primero.");
                return;
            }
            
            try {
                // Solicita acceso al micrófono
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                // Crea el grabador con formato webm
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                recordedChunks = [];
                
                // Cuando hay datos disponibles, los almacena
                mediaRecorder.ondataavailable = function(event) {
                    if (event.data.size > 0) {
                        recordedChunks.push(event.data);
                    }
                };
                
                // Cuando termina la grabación, procesa el audio
                mediaRecorder.onstop = function() {
                    // Crea un Blob con todos los fragmentos grabados
                    const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
                    
                    // Verifica el tamaño (límite 30MB para audio)
                    if (audioBlob.size > 30 * 1024 * 1024) {
                        alert('El audio es demasiado largo (máx 30MB).');
                        stream.getTracks().forEach(track => track.stop());
                        return;
                    }
                    
                    // FormData para subir audio
                    const formData = new FormData();
                    formData.append('file', audioBlob, 'audio.webm');
                    formData.append('media_type', 'audio');
                    formData.append('room', currentRoom);
                    formData.append('username', username);

                    fetch('/upload', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            socket.emit('message', {
                                username,
                                type: 'audio',
                                content: data.url,  // URL de Cloudinary
                                room: currentRoom
                            });
                        } else {
                            alert("Error al subir audio: " + data.error);
                        }
                    })
                    .catch(error => {
                        console.error("Error:", error);
                        alert("Error al subir audio");
                    });

                    // Detiene el stream
                    stream.getTracks().forEach(track => track.stop());
                };
                
                // Inicia la grabación
                mediaRecorder.start();
                $('#audioControls').show();
                
            } catch (err) {
                console.error('Error al acceder al micrófono:', err);
                alert('No se pudo acceder al micrófono. Verifica los permisos.');
            }
        });
        
        // Detener grabación de audio
        $('#stopAudio').on('click', function() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                $('#audioControls').hide();
            }
        });
        
        // Cancelar grabación de audio
        $('#cancelAudio').on('click', function() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                recordedChunks = [];  // Descarta los datos
                $('#audioControls').hide();
            }
        });
        
        // ===== FUNCIONES PARA GRABACIÓN DE VIDEO =====
        
        // Iniciar grabación de video
        $('#videoBtn').on('click', async function() {
            if (!username || !currentRoom) {
                alert("Debes establecer un usuario y unirte a una sala primero.");
                return;
            }
            
            try {
                // Solicita acceso a cámara y micrófono
                videoStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 1920, height: 1080 },  // Resolución Full HD 1080p
                    audio: true 
                });
                
                // Muestra preview del video
                $('#videoPreview')[0].srcObject = videoStream;
                
                // Crea el grabador
                mediaRecorder = new MediaRecorder(videoStream, { mimeType: 'video/webm' });
                recordedChunks = [];
                
                // Almacena los datos
                mediaRecorder.ondataavailable = function(event) {
                    if (event.data.size > 0) {
                        recordedChunks.push(event.data);
                    }
                };
                
                // Procesa el video al terminar
                mediaRecorder.onstop = function() {
                    const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
                    
                    // Verifica el tamaño (límite 100MB para video Full HD)
                    if (videoBlob.size > 100 * 1024 * 1024) {
                        alert('El video es demasiado largo (máx 100MB). Intenta grabaciones más cortas.');
                        videoStream.getTracks().forEach(track => track.stop());
                        return;
                    }
                    
                    // FormData para subir video
                    const formData = new FormData();
                    formData.append('file', videoBlob, 'video.webm');
                    formData.append('media_type', 'video');
                    formData.append('room', currentRoom);
                    formData.append('username', username);

                    fetch('/upload', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            socket.emit('message', {
                                username,
                                type: 'video',
                                content: data.url,  // URL de Cloudinary
                                room: currentRoom
                            });
                        } else {
                            alert("Error al subir video: " + data.error);
                        }
                    })
                    .catch(error => {
                        console.error("Error:", error);
                        alert("Error al subir video");
                    });

                    // Detiene el stream
                    videoStream.getTracks().forEach(track => track.stop());
                };
                
                // Inicia la grabación
                mediaRecorder.start();
                $('#videoControls').show();
                
            } catch (err) {
                console.error('Error al acceder a cámara/micrófono:', err);
                alert('No se pudo acceder a la cámara/micrófono. Verifica los permisos.');
            }
        });
        
        // Detener grabación de video
        $('#stopVideo').on('click', function() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                $('#videoControls').hide();
            }
        });
        
        // Cancelar grabación de video
        $('#cancelVideo').on('click', function() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                recordedChunks = [];  // Descarta los datos
                $('#videoControls').hide();
                if (videoStream) {
                    videoStream.getTracks().forEach(track => track.stop());
                }
            }
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
                    // Mensaje de audio con reproductor HTML5
                    $('#messages').append(`
                        <li class="list-group-item" data-own="${ownAttr}">
                            ${!isOwn ? `<strong>${msg.username}</strong>` : ''}
                            <div class="message-bubble">
                                🎤 Audio
                                <audio controls style="max-width: 100%; margin-top: 5px;">
                                    <source src="${msg.content}" type="audio/webm">
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
                                🎥 Video
                                <video controls style="max-width: 250px; border-radius: 8px; margin-top: 5px;">
                                    <source src="${msg.content}" type="video/webm">
                                    Tu navegador no soporta video HTML5.
                                </video>
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