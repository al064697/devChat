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
        let audioStream = null;  // Stream de audio para grabación
        let captureMode = null;  // Modo actual de captura
        let discardRecording = false;  // Indica si se descarta una grabación

        // ============ DARK MODE (Light / Dark / Auto) ============
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Función para aplicar el tema
        function applyTheme(theme) {
            if (theme === 'auto') {
                // En modo auto, remover el atributo para que use prefers-color-scheme
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
            }
            updateThemeIcon(theme);
        }

        // Función para actualizar el ícono según el modo
        function updateThemeIcon(theme) {
            let iconClass, title;
            if (theme === 'light') {
                iconClass = 'bi-sun-fill';
                title = 'Tema: Claro\nClic para cambiar a Oscuro';
            } else if (theme === 'dark') {
                iconClass = 'bi-moon-stars-fill';
                title = 'Tema: Oscuro\nClic para cambiar a Automático';
            } else { // auto
                const systemTheme = systemPrefersDark.matches ? 'oscuro' : 'claro';
                iconClass = 'bi-arrow-clockwise';
                title = `Tema: Automático (${systemTheme})\nClic para cambiar a Claro`;
            }
            $('#darkModeToggle').html(`<i class="bi ${iconClass}"></i>`).attr('title', title);
        }

        // Aplicar tema inicial desde localStorage o modo auto
        const savedTheme = localStorage.getItem('theme') || 'auto';
        applyTheme(savedTheme);

        // Toggle entre los tres modos: light → dark → auto → light
        $('#darkModeToggle').on('click', function() {
            const currentTheme = localStorage.getItem('theme') || 'auto';
            let newTheme;
            
            if (currentTheme === 'light') {
                newTheme = 'dark';
            } else if (currentTheme === 'dark') {
                newTheme = 'auto';
            } else { // auto
                newTheme = 'light';
            }
            
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });

        // Escuchar cambios en la preferencia del sistema (solo afecta en modo auto)
        systemPrefersDark.addEventListener('change', (e) => {
            const currentTheme = localStorage.getItem('theme') || 'auto';
            if (currentTheme === 'auto') {
                // Actualizar el tooltip en modo auto cuando cambia el sistema
                updateThemeIcon('auto');
            }
        });

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

        // Helper de alerta personalizada (reemplaza alert nativo).
        function showToast(type, message, options = {}) {
            const container = document.getElementById('toastContainer');
            if (!container) {
                alert(message);
                return;
            }

            const toast = document.createElement('div');
            toast.className = `toast-card toast--${type}`;
            toast.setAttribute('role', 'alert');

            const title = document.createElement('div');
            title.className = 'toast-title';
            title.textContent = options.title || 'Aviso';

            const text = document.createElement('div');
            text.className = 'toast-message';
            text.textContent = message;

            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'toast-action btn btn-primary';
            action.textContent = options.actionLabel || 'Aceptar';
            action.addEventListener('click', () => dismissToast(toast));

            toast.appendChild(title);
            toast.appendChild(text);
            toast.appendChild(action);
            container.appendChild(toast);

            const autoClose = options.autoClose ?? (type === 'success');
            const timeout = options.timeout ?? 2500;
            if (autoClose && timeout > 0) {
                setTimeout(() => dismissToast(toast), timeout);
            }
        }

        // Quita la alerta con una animacion de salida corta.
        function dismissToast(toast) {
            if (!toast || toast.classList.contains('is-hiding')) return;
            toast.classList.add('is-hiding');
            setTimeout(() => {
                const container = toast.parentElement;
                toast.remove();
                if (container && container.children.length === 0) {
                    container.classList.remove('is-active');
                }
            }, 180);
        }

        // Verifica si hay usuario y sala antes de permitir acciones de media.
        function ensureReadyForMedia() {
            if (!username || !currentRoom) {
                showToast('warning', "Debes establecer un usuario y unirte a una sala primero.");
                return false;
            }
            return true;
        }

        // Actualiza el estado visual de grabacion en el preview.
        function setRecordingStatus(text, active) {
            const statusEl = $('#recordingStatus');
            statusEl.text(text || '');
            statusEl.toggle(!!text);
            statusEl.toggleClass('active', !!active);
        }

        // Muestra u oculta el panel de preview.
        function showMediaPreview(show) {
            $('#mediaPreview').toggle(!!show);
        }

        // Detiene todas las tracks de un stream.
        function stopStream(stream) {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        }

        // Limpia el UI de captura y vuelve a valores por defecto.
        function resetCaptureUi() {
            captureMode = null;
            $('#cameraPreview').prop('srcObject', null).hide();
            $('#capturePhotoBtn').hide();
            $('#audioRecordBtn').text('🎙️');
            $('#videoRecordBtn').text('🎥');
            setRecordingStatus('', false);
            showMediaPreview(false);
        }

        // Detiene todos los streams activos.
        function stopAllStreams() {
            stopStream(cameraStream);
            stopStream(videoStream);
            stopStream(audioStream);
            cameraStream = null;
            videoStream = null;
            audioStream = null;
        }

        // Valida y sube archivos al backend, luego emite el mensaje.
        function uploadMediaFile(file, mediaType, msgType) {
            if (!ensureReadyForMedia()) return;

            let maxSize = 50 * 1024 * 1024; // 50MB por defecto
            if (msgType === 'image') {
                maxSize = 25 * 1024 * 1024; // 25MB imagen
            } else if (msgType === 'video') {
                maxSize = 100 * 1024 * 1024; // 100MB video
            } else if (msgType === 'audio') {
                maxSize = 30 * 1024 * 1024; // 30MB audio
            }

            if (file.size > maxSize) {
                showToast('warning', `El archivo es demasiado grande. Maximo ${Math.round(maxSize / (1024 * 1024))}MB.`);
                return;
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
                    showToast('error', "Error al subir archivo: " + data.error);
                }
            })
            .catch(error => {
                console.error("Error:", error);
                showToast('error', "Error al subir archivo");
            });
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
                showToast('success', `Nombre de usuario establecido: ${username}`);
            } else {
                showToast('warning', "El nombre de usuario no puede estar vacío.");
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
                showToast('warning', "Debes establecer un nombre de usuario antes de unirte a una sala.");
                return;
            }
            if (roomName.length === 0) {
                showToast('warning', "El nombre de la sala no puede estar vacío.");
                return;
            }
            if (currentRoom) {
                showToast('warning', "Ya estás en una sala. Sal primero antes de unirte a otra.");
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
                showToast('warning', "No estás en ninguna sala.");
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
                showToast('warning', "Debes establecer un usuario y unirte a una sala primero.");
                return;
            }

            if (!file) return;

            const fileNameLower = (file.name || '').toLowerCase();
            const isImage = file.type.startsWith('image/') || fileNameLower.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/);
            const isVideo = file.type.startsWith('video/') || fileNameLower.match(/\.(mp4|mov|webm|mkv|avi)$/);
            const isAudio = file.type.startsWith('audio/') || fileNameLower.match(/\.(mp3|wav|ogg|m4a|aac)$/);
            const isPDF = file.type === 'application/pdf' || fileNameLower.match(/\.pdf$/);
            const isOffice = fileNameLower.match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/);

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

            uploadMediaFile(file, mediaType, msgType);

            $('#clipInput').val('');
        });

        // Inicia flujo para capturar foto desde la camara.
        $('#photoBtn').on('click', async function() {
            if (!ensureReadyForMedia()) return;
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                showToast('warning', "Hay una grabación en curso.");
                return;
            }

            try {
                stopAllStreams();
                captureMode = 'photo';
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                cameraStream = stream;
                const videoEl = $('#cameraPreview')[0];
                videoEl.srcObject = stream;
                $('#cameraPreview').show();
                $('#capturePhotoBtn').show();
                setRecordingStatus('Vista previa de foto', false);
                showMediaPreview(true);
            } catch (err) {
                console.error(err);
                showToast('error', "No se pudo acceder a la cámara.");
                stopAllStreams();
                resetCaptureUi();
            }
        });

        // Toma la foto desde el video preview y la sube.
        $('#capturePhotoBtn').on('click', function() {
            const videoEl = $('#cameraPreview')[0];
            const canvas = $('#photoCanvas')[0];
            if (!videoEl || !cameraStream) return;

            const width = videoEl.videoWidth || 640;
            const height = videoEl.videoHeight || 480;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoEl, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (!blob) return;
                const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
                uploadMediaFile(file, 'image', 'image');
            }, 'image/jpeg', 0.9);

            stopAllStreams();
            resetCaptureUi();
        });

        // Inicia o detiene grabacion de audio.
        $('#audioRecordBtn').on('click', async function() {
            if (!ensureReadyForMedia()) return;

            if (mediaRecorder && mediaRecorder.state === 'recording' && captureMode === 'audio') {
                mediaRecorder.stop();
                return;
            }

            if (mediaRecorder && mediaRecorder.state === 'recording') {
                showToast('warning', "Hay una grabación en curso.");
                return;
            }

            try {
                stopAllStreams();
                captureMode = 'audio';
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioStream = stream;
                recordedChunks = [];
                mediaRecorder = new MediaRecorder(stream);

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) recordedChunks.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                    if (!discardRecording) {
                        const ext = blob.type.includes('wav') ? 'wav' : (blob.type.includes('mpeg') ? 'mp3' : 'webm');
                        const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
                        uploadMediaFile(file, 'audio', 'audio');
                    }
                    discardRecording = false;
                    stopAllStreams();
                    resetCaptureUi();
                };

                mediaRecorder.start();
                $('#audioRecordBtn').text('⏹️');
                $('#cameraPreview').hide();
                $('#capturePhotoBtn').hide();
                setRecordingStatus('Grabando audio...', true);
                showMediaPreview(true);
            } catch (err) {
                console.error(err);
                showToast('error', "No se pudo acceder al micrófono.");
                stopAllStreams();
                resetCaptureUi();
            }
        });

        // Inicia o detiene grabacion de video.
        $('#videoRecordBtn').on('click', async function() {
            if (!ensureReadyForMedia()) return;

            if (mediaRecorder && mediaRecorder.state === 'recording' && captureMode === 'video') {
                mediaRecorder.stop();
                return;
            }

            if (mediaRecorder && mediaRecorder.state === 'recording') {
                showToast('warning', "Hay una grabación en curso.");
                return;
            }

            try {
                stopAllStreams();
                captureMode = 'video';
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                videoStream = stream;
                const videoEl = $('#cameraPreview')[0];
                videoEl.srcObject = stream;
                $('#cameraPreview').show();
                $('#capturePhotoBtn').hide();

                recordedChunks = [];
                mediaRecorder = new MediaRecorder(stream);

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) recordedChunks.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
                    if (!discardRecording) {
                        const file = new File([blob], `video_${Date.now()}.webm`, { type: blob.type || 'video/webm' });
                        uploadMediaFile(file, 'video', 'video');
                    }
                    discardRecording = false;
                    stopAllStreams();
                    resetCaptureUi();
                };

                mediaRecorder.start();
                $('#videoRecordBtn').text('⏹️');
                setRecordingStatus('Grabando video...', true);
                showMediaPreview(true);
            } catch (err) {
                console.error(err);
                showToast('error', "No se pudo acceder a cámara y micrófono.");
                stopAllStreams();
                resetCaptureUi();
            }
        });

        // Cierra el preview y detiene streams.
        $('#stopPreviewBtn').on('click', function() {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                discardRecording = true;
                mediaRecorder.stop();
                return;
            }
            stopAllStreams();
            resetCaptureUi();
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
                
                // Render segun el tipo de mensaje recibido.
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
                showToast('warning', "Debes establecer un nombre de usuario antes de enviar mensajes.");
                return;
            }
            if (!currentRoom) {
                showToast('warning', "Debes unirte a una sala antes de enviar mensajes.");
                return;
            }
            if (message.length === 0) {
                showToast('warning', "El mensaje no puede estar vacío.");
                return;
            }
            if (message.length > 1000) {
                showToast('warning', "El mensaje no puede exceder los 1000 caracteres.");
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
            showToast('error', "No se pudo conectar al servidor. Verifica tu conexión.");
        });

        // Aviso visual cuando se pierde la conexion.
        socket.on("disconnect", () => {
            $('#messages').append(`<li class="list-group-item text-muted text-center"><small>⚠ Desconectado. Intentando reconectar...</small></li>`);
            $('#messages').scrollTop($('#messages')[0].scrollHeight);
        });

        // Aviso visual cuando se reconecta.
        socket.on("connect", () => {
            $('#messages').append(`<li class="list-group-item text-muted text-center"><small>✓ Conectado al servidor</small></li>`);
            $('#messages').scrollTop($('#messages')[0].scrollHeight);
        });