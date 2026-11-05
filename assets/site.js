/* ==========================================================================
   Sitio "Creación" — comportamiento común
   - Acordeón de secciones: se anima con CSS (grid-template-rows); aquí solo
     se conmuta la clase .open y el estado accesible (aria-expanded).
   - Reproductor de audio propio: se construye sobre los <audio> que ya
     existen en el marcado (mejora progresiva, sin tocar el HTML).
   - Ventana de vídeo: las miniaturas no reproducen nada; al pulsarlas el
     vídeo se abre a tamaño grande en una ventana superpuesta.
   ========================================================================== */
(function () {
    'use strict';

    /* --- Acordeón --------------------------------------------------------- */
    document.querySelectorAll('.section').forEach(function (section) {
        var header = section.querySelector('.section-header');
        var body = section.querySelector('.section-body');
        if (!header || !body) {
            return;
        }

        header.setAttribute(
            'aria-expanded',
            section.classList.contains('open') ? 'true' : 'false'
        );

        header.addEventListener('click', function () {
            var isOpen = section.classList.toggle('open');
            header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    });

    /* --- Reproductor de audio --------------------------------------------- */
    var ICON_PLAY =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M8 5v14l11-7z"/></svg>';
    var ICON_PAUSE =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

    var audios = [];

    function formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) {
            seconds = 0;
        }
        var total = Math.floor(seconds);
        var minutes = Math.floor(total / 60);
        var rest = total % 60;
        return minutes + ':' + (rest < 10 ? '0' : '') + rest;
    }

    function playQuietly(media) {
        var promise = media.play();
        if (promise && typeof promise.catch === 'function') {
            promise.catch(function () {
                /* Archivo ausente o reproducción no permitida: se ignora. */
            });
        }
    }

    function enhanceTrack(track) {
        var audio = track.querySelector('audio');
        if (!audio || track.querySelector('.player')) {
            return;
        }

        var nameEl = track.querySelector('.track-name');
        var name = nameEl ? nameEl.textContent.replace(/\s+/g, ' ').trim() : '';

        audio.removeAttribute('controls');
        audios.push(audio);

        var player = document.createElement('div');
        player.className = 'player';
        player.innerHTML =
            '<button class="player-toggle" type="button" aria-pressed="false">' +
            ICON_PLAY +
            '</button>' +
            '<div class="player-bar" role="slider" tabindex="0" ' +
            'aria-label="Posición de reproducción" aria-valuemin="0" ' +
            'aria-valuemax="100" aria-valuenow="0" aria-valuetext="0:00">' +
            '<span class="player-fill"></span>' +
            '</div>' +
            '<span class="player-time">' +
            '<span class="player-cur">0:00</span>' +
            '<span class="player-sep">/</span>' +
            '<span class="player-total">0:00</span>' +
            '</span>';
        track.appendChild(player);

        var toggle = player.querySelector('.player-toggle');
        var bar = player.querySelector('.player-bar');
        var fill = player.querySelector('.player-fill');
        var current = player.querySelector('.player-cur');
        var total = player.querySelector('.player-total');
        var dragging = false;

        function renderProgress() {
            var duration = audio.duration;
            var hasDuration = isFinite(duration) && duration > 0;
            var percent = hasDuration
                ? Math.min(100, (audio.currentTime / duration) * 100)
                : 0;

            fill.style.width = percent + '%';
            bar.setAttribute('aria-valuenow', String(Math.round(percent)));
            bar.setAttribute('aria-valuetext', formatTime(audio.currentTime));
            current.textContent = formatTime(audio.currentTime);
            if (hasDuration) {
                total.textContent = formatTime(duration);
            }
        }

        function setPlayingState(playing) {
            track.classList.toggle('is-playing', playing);
            toggle.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
            toggle.setAttribute('aria-pressed', playing ? 'true' : 'false');
            toggle.setAttribute(
                'aria-label',
                (playing ? 'Pausar' : 'Reproducir') +
                    (name ? ' «' + name + '»' : '')
            );
        }

        function seekTo(clientX) {
            var duration = audio.duration;
            if (!isFinite(duration) || duration <= 0) {
                return;
            }
            var rect = bar.getBoundingClientRect();
            if (!rect.width) {
                return;
            }
            var ratio = (clientX - rect.left) / rect.width;
            ratio = Math.min(1, Math.max(0, ratio));
            audio.currentTime = ratio * duration;
            renderProgress();
        }

        setPlayingState(false);

        /* Con preload="none" la duración es desconocida: se pide solo cuando el
           visitante muestra interés (ratón encima o foco de teclado), de modo
           que no se lanzan decenas de peticiones al abrir la página. */
        var metadataAsked = false;
        function requestMetadata() {
            if (
                metadataAsked ||
                !audio.paused ||
                audio.readyState > 0 ||
                (audio.getAttribute('preload') || 'none') !== 'none'
            ) {
                return;
            }
            metadataAsked = true;
            audio.setAttribute('preload', 'metadata');
            audio.load();
        }

        track.addEventListener('pointerenter', requestMetadata);
        track.addEventListener('focusin', requestMetadata);

        toggle.addEventListener('click', function () {
            if (audio.paused) {
                playQuietly(audio);
            } else {
                audio.pause();
            }
        });

        bar.addEventListener('pointerdown', function (event) {
            dragging = true;
            try {
                bar.setPointerCapture(event.pointerId);
            } catch (error) {
                /* Puntero no capturable: se sigue con el arrastre normal. */
            }
            seekTo(event.clientX);
        });

        bar.addEventListener('pointermove', function (event) {
            if (dragging) {
                seekTo(event.clientX);
            }
        });

        bar.addEventListener('pointerup', function (event) {
            dragging = false;
            try {
                bar.releasePointerCapture(event.pointerId);
            } catch (error) {
                /* Nada que liberar. */
            }
        });

        bar.addEventListener('pointercancel', function () {
            dragging = false;
        });

        bar.addEventListener('keydown', function (event) {
            var duration = audio.duration;
            if (!isFinite(duration) || duration <= 0) {
                return;
            }
            var step = 5;
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                audio.currentTime = Math.min(duration, audio.currentTime + step);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                audio.currentTime = Math.max(0, audio.currentTime - step);
            } else if (event.key === 'Home') {
                audio.currentTime = 0;
            } else if (event.key === 'End') {
                audio.currentTime = duration;
            } else {
                return;
            }
            event.preventDefault();
            renderProgress();
        });

        audio.addEventListener('play', function () {
            setPlayingState(true);
            audios.forEach(function (other) {
                if (other !== audio && !other.paused) {
                    other.pause();
                }
            });
        });

        audio.addEventListener('pause', function () {
            setPlayingState(false);
        });

        audio.addEventListener('ended', function () {
            setPlayingState(false);
            audio.currentTime = 0;
            renderProgress();
        });

        audio.addEventListener('timeupdate', renderProgress);
        audio.addEventListener('loadedmetadata', renderProgress);
        audio.addEventListener('durationchange', renderProgress);
        audio.addEventListener('seeked', renderProgress);
    }

    document.querySelectorAll('.track').forEach(enhanceTrack);

    /* --- Ventana de vídeo -------------------------------------------------- */
    var modal = null;
    var modalPlayer = null;
    var modalIframe = null;
    var modalCaption = null;
    var modalClose = null;
    var lastFocused = null;

    function buildModal() {
        modal = document.createElement('div');
        modal.className = 'video-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Reproductor de vídeo');
        modal.innerHTML =
            '<button class="video-modal-close" type="button" ' +
            'aria-label="Cerrar">&times;</button>' +
            '<div class="video-modal-frame">' +
            '<video class="video-modal-player" controls playsinline ' +
            'preload="metadata"></video>' +
            '<iframe class="video-modal-iframe" title="Vídeo" ' +
            'referrerpolicy="strict-origin-when-cross-origin" ' +
            'allow="accelerometer; autoplay; clipboard-write; ' +
            'encrypted-media; gyroscope; picture-in-picture; web-share" ' +
            'allowfullscreen></iframe>' +
            '</div>' +
            '<div class="video-modal-caption"></div>';
        document.body.appendChild(modal);

        modalPlayer = modal.querySelector('.video-modal-player');
        modalIframe = modal.querySelector('.video-modal-iframe');
        modalCaption = modal.querySelector('.video-modal-caption');
        modalClose = modal.querySelector('.video-modal-close');

        modalClose.addEventListener('click', closeVideo);
        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
                closeVideo();
            }
        });
    }

    function openVideo(src, poster, title, youtubeId) {
        if (!modal) {
            buildModal();
        }

        lastFocused = document.activeElement;
        if (youtubeId) {
            modalPlayer.style.display = 'none';
            modalIframe.style.display = 'block';
            modalIframe.src =
                'https://www.youtube-nocookie.com/embed/' + youtubeId +
                '?autoplay=1&rel=0';
        } else {
            modalIframe.style.display = 'none';
            modalIframe.src = '';
            modalPlayer.style.display = 'block';
            modalPlayer.setAttribute('src', src);
            if (poster) {
                modalPlayer.setAttribute('poster', poster);
            } else {
                modalPlayer.removeAttribute('poster');
            }
        }
        modalCaption.textContent = title || '';
        modal.classList.add('is-open');
        document.body.classList.add('has-modal');
        modalClose.focus();
        if (!youtubeId) {
            playQuietly(modalPlayer);
        }
    }

    function closeVideo() {
        if (!modal || !modal.classList.contains('is-open')) {
            return;
        }
        modalPlayer.pause();
        modalPlayer.removeAttribute('src');
        modalPlayer.load();
        modalIframe.src = '';
        modal.classList.remove('is-open');
        document.body.classList.remove('has-modal');
        if (lastFocused && lastFocused.focus) {
            lastFocused.focus();
        }
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' || event.key === 'Esc') {
            closeVideo();
        }
    });

    /* Cada tarjeta de vídeo se convierte en una miniatura pulsable: el vídeo
       no suena ni se reproduce aquí, solo se anuncia que se puede abrir. */
    document.querySelectorAll('.video-card').forEach(function (card) {
        var video = card.querySelector('video');
        if (!video) {
            return;
        }

        var source = video.querySelector('source');
        var src = source
            ? source.getAttribute('src') || ''
            : video.getAttribute('src') || '';
        if (!src) {
            return;
        }

        var poster = video.getAttribute('poster') || '';
        var titleEl = card.querySelector('.video-card-title');
        var title = titleEl
            ? titleEl.textContent.replace(/\s+/g, ' ').trim()
            : '';

        var trigger = document.createElement('button');
        trigger.className = 'video-thumb';
        trigger.type = 'button';
        trigger.setAttribute(
            'aria-label',
            'Reproducir vídeo' + (title ? ': ' + title : '')
        );

        var media;
        if (poster) {
            media = document.createElement('img');
            media.src = poster;
            media.alt = title;
            media.loading = 'lazy';
            media.decoding = 'async';
        } else {
            /* Sin póster: se usa el primer fotograma como miniatura. */
            media = document.createElement('video');
            media.preload = 'metadata';
            media.muted = true;
            media.tabIndex = -1;
            media.setAttribute('playsinline', '');
            var firstSource = document.createElement('source');
            firstSource.src = src;
            firstSource.type = 'video/mp4';
            media.appendChild(firstSource);
        }
        trigger.appendChild(media);

        var overlay = document.createElement('span');
        overlay.className = 'video-thumb-overlay';
        trigger.appendChild(overlay);

        trigger.addEventListener('click', function () {
            openVideo(src, poster, title);
        });

        video.replaceWith(trigger);

        var hint = card.querySelector('.play-hint');
        if (hint) {
            hint.remove();
        }
    });

    /* Miniaturas con embed de YouTube (data-youtube): al pulsarlas la ventana
       muestra el reproductor incrustado, no un enlace externo. */
    document.querySelectorAll('.video-thumb[data-youtube]').forEach(
        function (trigger) {
            var id = trigger.getAttribute('data-youtube');
            var title = trigger.getAttribute('data-title') || '';
            trigger.addEventListener('click', function () {
                openVideo(null, null, title, id);
            });
        }
    );
})();
