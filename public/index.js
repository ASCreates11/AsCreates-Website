/* ==========================================================================
   AS Creates - Interactive JavaScript Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- Header Scroll Effect & Directional Animation ---
    const header = document.getElementById('top-nav');
    let lastScrollY = window.scrollY;
    let scrollUpTimeout = null;
    
    const handleScroll = () => {
        const currentScrollY = window.scrollY;
        
        // Toggle scrolled background style
        if (currentScrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        // Directional hide/show animation logic
        if (currentScrollY > lastScrollY && currentScrollY > 80) {
            // Scrolling down - hide header
            header.classList.add('header-hidden');
            if (scrollUpTimeout) {
                clearTimeout(scrollUpTimeout);
                scrollUpTimeout = null;
            }
        } else if (currentScrollY < lastScrollY) {
            // Scrolling up - show header
            header.classList.remove('header-hidden');
            
            // Clear previous hide timeout
            if (scrollUpTimeout) {
                clearTimeout(scrollUpTimeout);
            }
            
            // Keep header visible for 1 second, then hide it again (only if scrolled down)
            if (currentScrollY > 80) {
                scrollUpTimeout = setTimeout(() => {
                    header.classList.add('header-hidden');
                }, 1000);
            }
        }
        
        lastScrollY = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll);
    // Initial run in case the page loaded scrolled down
    handleScroll();

    // --- Mobile Menu Drawer Logic ---
    const mobileMenuToggle = document.getElementById('mobile-toggle');
    const mobileMenuClose = document.getElementById('mobile-close');
    const mobileMenuOverlay = document.getElementById('mobile-overlay');
    const mobileMenuDrawer = document.getElementById('mobile-drawer');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');

    const openMobileMenu = () => {
        mobileMenuOverlay.classList.add('active');
        mobileMenuDrawer.classList.add('active');
        document.body.style.overflow = 'hidden'; // Stop background scrolling
    };

    const closeMobileMenu = () => {
        mobileMenuOverlay.classList.remove('active');
        mobileMenuDrawer.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    };

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', openMobileMenu);
    }
    
    if (mobileMenuClose) {
        mobileMenuClose.addEventListener('click', closeMobileMenu);
    }
    
    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    }

    mobileLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    // --- Active Link Tracking on Scroll ---
    const sections = document.querySelectorAll('section, footer');
    const navLinks = document.querySelectorAll('.nav-link');
    const mobLinks = document.querySelectorAll('.mobile-nav-link');

    const updateActiveLink = () => {
        const path = window.location.pathname;
        const isHomepage = path === '/' || path === '/index' || path.endsWith('index.html');
        if (!isHomepage) return;

        let currentSectionId = 'home';
        
        // Find which section is currently occupying the center/top area of the screen
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120; // Offset for header height
            const sectionHeight = section.offsetHeight;
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                if (section.id) {
                    currentSectionId = section.id;
                }
            }
        });

        // Set active class on desktop links
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });

        // Set active class on mobile links
        mobLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', updateActiveLink);
    // Initial run to highlight correctly on load
    updateActiveLink();

    // --- Smooth Anchor Navigation ---
    const allNavLinks = document.querySelectorAll('.nav-link, .mobile-nav-link, .scroll-down, .logo');
    allNavLinks.forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                e.preventDefault();
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    const headerOffset = window.scrollY > 50 ? 64 : 80;
                    const elementPosition = targetElement.offsetTop;
                    const offsetPosition = elementPosition - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // --- Share Button Logic ---
    const shareButtons = document.querySelectorAll('.share-btn');
    
    // Create toast container if it doesn't exist
    let toast = document.querySelector('.share-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'share-toast';
        toast.textContent = 'Link copied to clipboard!';
        document.body.appendChild(toast);
    }
    
    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    };

    shareButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const shareData = {
                title: 'AS Creates',
                text: 'AS Creates - Digital Agency & Technology Solutions',
                url: window.location.origin + window.location.pathname
            };
            
            if (navigator.share) {
                try {
                    await navigator.share(shareData);
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Error sharing:', err);
                    }
                }
            } else {
                try {
                    await navigator.clipboard.writeText(shareData.url);
                    showToast('Link copied to clipboard!');
                } catch (err) {
                    console.error('Failed to copy text:', err);
                    showToast('Failed to copy link. Copy it from your URL bar.');
                }
            }
        });
    });

    // --- Team Section Interactive POV Logic (About Us Page) ---
    const foundersGrid = document.getElementById('foundersGrid');
    const founderCardSriyanka = document.getElementById('founderCardSriyanka');
    const founderCardAsish = document.getElementById('founderCardAsish');
    const povBox = document.getElementById('povBox');
    const povContentSriyanka = document.getElementById('povContentSriyanka');
    const povContentAsish = document.getElementById('povContentAsish');

    if (foundersGrid && founderCardSriyanka && founderCardAsish && povBox) {
        let activeScrollY = 0;
        let autoCycleActive = true;
        let currentPOV = 'sriyanka';
        let autoCycleInterval = null;

        const showSriyankaPOV = () => {
            povContentAsish.style.display = 'none';
            povContentSriyanka.style.display = 'block';
            foundersGrid.classList.add('show-pov-sriyanka');
            foundersGrid.classList.remove('show-pov-asish');
        };

        const showAsishPOV = () => {
            povContentSriyanka.style.display = 'none';
            povContentAsish.style.display = 'block';
            foundersGrid.classList.add('show-pov-asish');
            foundersGrid.classList.remove('show-pov-sriyanka');
        };

        const clearPOV = (force = false) => {
            if (!force && (foundersGrid.classList.contains('active-sriyanka') || foundersGrid.classList.contains('active-asish'))) {
                return;
            }
            foundersGrid.classList.remove('show-pov-sriyanka', 'show-pov-asish');
        };

        const startTimer = () => {
            if (!autoCycleActive) return;
            if (autoCycleInterval) clearInterval(autoCycleInterval);
            
            autoCycleInterval = setInterval(() => {
                currentPOV = (currentPOV === 'sriyanka') ? 'asish' : 'sriyanka';
                if (currentPOV === 'sriyanka') {
                    showSriyankaPOV();
                } else {
                    showAsishPOV();
                }
            }, 3500);
        };

        const stopAutoCycle = () => {
            autoCycleActive = false;
            if (autoCycleInterval) {
                clearInterval(autoCycleInterval);
                autoCycleInterval = null;
            }
        };

        const pauseAutoCycle = () => {
            if (autoCycleInterval) {
                clearInterval(autoCycleInterval);
                autoCycleInterval = null;
            }
        };

        // Initialize auto cycle on page load
        showSriyankaPOV();
        startTimer();

        // Sriyanka Hover
        founderCardSriyanka.addEventListener('mouseenter', () => {
            if (autoCycleActive) {
                pauseAutoCycle();
                showSriyankaPOV();
                currentPOV = 'sriyanka';
            } else if (!foundersGrid.classList.contains('active-sriyanka') && !foundersGrid.classList.contains('active-asish')) {
                showSriyankaPOV();
            }
        });

        // Asish Hover
        founderCardAsish.addEventListener('mouseenter', () => {
            if (autoCycleActive) {
                pauseAutoCycle();
                showAsishPOV();
                currentPOV = 'asish';
            } else if (!foundersGrid.classList.contains('active-sriyanka') && !foundersGrid.classList.contains('active-asish')) {
                showAsishPOV();
            }
        });

        // Grid Mouse Leave
        foundersGrid.addEventListener('mouseleave', () => {
            if (autoCycleActive) {
                startTimer();
            } else {
                clearPOV();
            }
        });

        // Sriyanka Click
        founderCardSriyanka.addEventListener('click', (e) => {
            e.stopPropagation();
            stopAutoCycle(); // Disable auto-cycle permanently
            if (foundersGrid.classList.contains('active-sriyanka')) {
                foundersGrid.classList.remove('active-sriyanka');
                clearPOV(true);
            } else {
                foundersGrid.classList.remove('active-asish');
                foundersGrid.classList.add('active-sriyanka');
                showSriyankaPOV();
                activeScrollY = window.scrollY;
            }
        });

        // Asish Click
        founderCardAsish.addEventListener('click', (e) => {
            e.stopPropagation();
            stopAutoCycle(); // Disable auto-cycle permanently
            if (foundersGrid.classList.contains('active-asish')) {
                foundersGrid.classList.remove('active-asish');
                clearPOV(true);
            } else {
                foundersGrid.classList.remove('active-sriyanka');
                foundersGrid.classList.add('active-asish');
                showAsishPOV();
                activeScrollY = window.scrollY;
            }
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!foundersGrid.contains(e.target)) {
                foundersGrid.classList.remove('active-sriyanka', 'active-asish');
                clearPOV(true);
            }
        });

        // Scroll reset logic (resets if user scrolls by more than 200px)
        window.addEventListener('scroll', () => {
            if (foundersGrid.classList.contains('active-sriyanka') || foundersGrid.classList.contains('active-asish')) {
                if (Math.abs(window.scrollY - activeScrollY) > 200) {
                    foundersGrid.classList.remove('active-sriyanka', 'active-asish');
                    clearPOV(true);
                }
            }
        });
    }

    // --- Team Section Interactive POV Logic (Home landing Page) ---
    const foundersGridHome = document.getElementById('foundersGridHome');
    const founderCardSriyankaHome = document.getElementById('founderCardSriyankaHome');
    const founderCardAsishHome = document.getElementById('founderCardAsishHome');
    const povBoxHome = document.getElementById('povBoxHome');
    const povContentSriyankaHome = document.getElementById('povContentSriyankaHome');
    const povContentAsishHome = document.getElementById('povContentAsishHome');

    if (foundersGridHome && founderCardSriyankaHome && founderCardAsishHome && povBoxHome) {
        let activeScrollYHome = 0;

        const showSriyankaPOVHome = () => {
            povContentAsishHome.style.display = 'none';
            povContentSriyankaHome.style.display = 'block';
            foundersGridHome.classList.add('show-pov-sriyanka');
            foundersGridHome.classList.remove('show-pov-asish');
        };

        const showAsishPOVHome = () => {
            povContentSriyankaHome.style.display = 'none';
            povContentAsishHome.style.display = 'block';
            foundersGridHome.classList.add('show-pov-asish');
            foundersGridHome.classList.remove('show-pov-sriyanka');
        };

        const clearPOVHome = (force = false) => {
            if (!force && (foundersGridHome.classList.contains('active-sriyanka') || foundersGridHome.classList.contains('active-asish'))) {
                return;
            }
            foundersGridHome.classList.remove('show-pov-sriyanka', 'show-pov-asish');
        };

        // Sriyanka Hover
        founderCardSriyankaHome.addEventListener('mouseenter', () => {
            if (!foundersGridHome.classList.contains('active-sriyanka') && !foundersGridHome.classList.contains('active-asish')) {
                showSriyankaPOVHome();
            }
        });

        // Asish Hover
        founderCardAsishHome.addEventListener('mouseenter', () => {
            if (!foundersGridHome.classList.contains('active-sriyanka') && !foundersGridHome.classList.contains('active-asish')) {
                showAsishPOVHome();
            }
        });

        // Grid Mouse Leave
        foundersGridHome.addEventListener('mouseleave', () => {
            clearPOVHome();
        });

        // Sriyanka Click
        founderCardSriyankaHome.addEventListener('click', (e) => {
            e.stopPropagation();
            if (foundersGridHome.classList.contains('active-sriyanka')) {
                foundersGridHome.classList.remove('active-sriyanka');
                clearPOVHome(true);
            } else {
                foundersGridHome.classList.remove('active-asish');
                foundersGridHome.classList.add('active-sriyanka');
                showSriyankaPOVHome();
                activeScrollYHome = window.scrollY;
            }
        });

        // Asish Click
        founderCardAsishHome.addEventListener('click', (e) => {
            e.stopPropagation();
            if (foundersGridHome.classList.contains('active-asish')) {
                foundersGridHome.classList.remove('active-asish');
                clearPOVHome(true);
            } else {
                foundersGridHome.classList.remove('active-sriyanka');
                foundersGridHome.classList.add('active-asish');
                showAsishPOVHome();
                activeScrollYHome = window.scrollY;
            }
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!foundersGridHome.contains(e.target)) {
                foundersGridHome.classList.remove('active-sriyanka', 'active-asish');
                clearPOVHome(true);
            }
        });

        // Scroll reset logic
        window.addEventListener('scroll', () => {
            if (foundersGridHome.classList.contains('active-sriyanka') || foundersGridHome.classList.contains('active-asish')) {
                if (Math.abs(window.scrollY - activeScrollYHome) > 200) {
                    foundersGridHome.classList.remove('active-sriyanka', 'active-asish');
                    clearPOVHome(true);
                }
            }
        });
    }

    // --- Dynamic Team & Founders Hydration ---
    const loadDynamicTeam = async () => {
        try {
            const res = await fetch('/api/team');
            if (!res.ok) return;
            const team = await res.json();
            if (!Array.isArray(team) || team.length === 0) return;

            const isFounder = m => m.is_founder === 1 || m.is_founder === true || String(m.is_founder) === '1';
            const founders = team.filter(isFounder);

            if (founders.length > 0) {
                // Find Sriyanka & Asish specifically by name or role to avoid order swapping
                const f1 = founders.find(m => (m.name && m.name.toLowerCase().includes('sriyanka')) || (m.role && m.role.toLowerCase().includes('ceo'))) || founders[0];
                const f2 = founders.find(m => m !== f1 && ((m.name && m.name.toLowerCase().includes('asish')) || (m.role && m.role.toLowerCase().includes('cto')))) || founders[1] || f1;

                const f1Card = document.getElementById('founderCardSriyankaHome');
                if (f1Card && f1) {
                    const img = f1Card.querySelector('img');
                    if (img && (f1.photo || f1.image_url)) img.src = f1.photo || f1.image_url;
                    const h3 = f1Card.querySelector('h3');
                    if (h3 && f1.name) h3.textContent = f1.name;
                    const role = f1Card.querySelector('.founder-role');
                    if (role && f1.role) role.textContent = f1.role;
                    const bio = f1Card.querySelector('.founder-bio');
                    if (bio && f1.bio) bio.textContent = f1.bio;
                }
                const pov1 = document.getElementById('povContentSriyankaHome');
                if (pov1 && f1) {
                    const pre = pov1.querySelector('.pov-pre-heading');
                    if (pre && f1.pov_pre_heading) pre.textContent = f1.pov_pre_heading;
                    const title = pov1.querySelector('.pov-title');
                    if (title && f1.pov_title) title.textContent = f1.pov_title;
                    const text = pov1.querySelector('.pov-text');
                    if (text && f1.pov_text) text.textContent = `"${f1.pov_text.replace(/^"|"$/g, '')}"`;
                }

                if (f2 && f2 !== f1) {
                    const f2Card = document.getElementById('founderCardAsishHome');
                    if (f2Card) {
                        const img = f2Card.querySelector('img');
                        if (img && (f2.photo || f2.image_url)) img.src = f2.photo || f2.image_url;
                        const h3 = f2Card.querySelector('h3');
                        if (h3 && f2.name) h3.textContent = f2.name;
                        const role = f2Card.querySelector('.founder-role');
                        if (role && f2.role) role.textContent = f2.role;
                        const bio = f2Card.querySelector('.founder-bio');
                        if (bio && f2.bio) bio.textContent = f2.bio;
                    }
                    const pov2 = document.getElementById('povContentAsishHome');
                    if (pov2) {
                        const pre = pov2.querySelector('.pov-pre-heading');
                        if (pre && f2.pov_pre_heading) pre.textContent = f2.pov_pre_heading;
                        const title = pov2.querySelector('.pov-title');
                        if (title && f2.pov_title) title.textContent = f2.pov_title;
                        const text = pov2.querySelector('.pov-text');
                        if (text && f2.pov_text) text.textContent = `"${f2.pov_text.replace(/^"|"$/g, '')}"`;
                    }
                }
            }

            const teamGrid = document.getElementById('teamMembersGridHome');
            const mainFounderIds = new Set(team.filter(isFounder).slice(0, 2).map(m => m.id));
            const otherMembers = team.filter(m => !isFounder(m) && !mainFounderIds.has(m.id));
            
            if (teamGrid) {
                if (otherMembers.length === 0) {
                    teamGrid.style.display = 'none';
                } else {
                    teamGrid.style.display = 'grid';
                    teamGrid.innerHTML = otherMembers.map(m => `
                        <div class="team-member-card">
                            <div class="member-img-container">
                                <img src="${m.photo || m.image_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'}" class="member-img" alt="${m.name}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';">
                            </div>
                            <h4>${m.name}</h4>
                            <div class="member-role">${m.role || ''}</div>
                            <p class="member-bio">${m.bio || ''}</p>
                        </div>
                    `).join('');
                }
            }
        } catch(e) { console.warn('Dynamic team hydration failed:', e); }
    };

    loadDynamicTeam();

    // --- WhatsApp Integration ---
    const initWhatsAppWidget = () => {
        // Create widget container
        const widgetContainer = document.createElement('div');
        widgetContainer.id = 'whatsapp-widget-container';
        widgetContainer.className = 'whatsapp-widget-container';
        
        // Generate current timestamp for mock message
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        const timeString = `${hours}:${minutes} ${ampm}`;
        
        widgetContainer.innerHTML = `
            <!-- Interactive Chat Box -->
            <div class="whatsapp-chat-box" id="whatsappChatBox" aria-hidden="true">
                <div class="chat-box-header">
                    <div class="chat-box-header-info">
                        <div class="chat-box-avatar">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            <span class="active-status-dot"></span>
                        </div>
                        <div class="chat-box-title">
                            <h4>AS Creates</h4>
                            <p>Typically replies in minutes</p>
                        </div>
                    </div>
                    <button class="chat-box-close" id="whatsappCloseBtn" aria-label="Close Chat">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                
                <div class="chat-box-body">
                    <div class="chat-message-bubble incoming">
                        <span class="chat-sender">AS Creates Support</span>
                        <div class="chat-message-content">
                            <p>Hi there! 👋 Welcome to AS Creates. How can we help you today with your digital solutions?</p>
                        </div>
                        <span class="chat-time">${timeString}</span>
                    </div>
                </div>
                
                <div class="chat-box-footer">
                    <a href="https://wa.me/917787977085?text=Hi%20AS%20Creates,%20I'd%20like%20to%20discuss%20a%20project!" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       class="whatsapp-chat-btn" 
                       id="whatsappChatLink">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.37 5.048L2 22l5.09-1.332a9.929 9.929 0 004.919 1.29c5.507 0 9.99-4.478 9.99-9.984 0-2.67-1.04-5.178-2.927-7.064S14.686 2 12.012 2zm5.842 14.15c-.246.695-1.436 1.306-1.97 1.365-.487.054-1.12.078-2.527-.478a10.024 10.024 0 01-4.32-3.805c-.888-1.214-1.572-2.628-1.572-4.09 0-1.552.812-2.316 1.102-2.611.23-.23.51-.342.744-.342.078 0 .15.004.215.008.204.01.408.016.586.398.225.485.768 1.87.835 2.008.067.138.112.298.02.482-.09.184-.136.298-.27.46-.135.163-.284.364-.407.49-.138.143-.28.3-.122.573.16.27.7 1.15 1.502 1.861.802.71 1.48.93 1.69 1.023.21.092.336.078.462-.06.127-.14.542-.63.687-.847.143-.217.288-.183.487-.11.2.074 1.27.6 1.488.71.217.11.362.16.417.253.054.093.054.542-.192 1.237z"/>
                        </svg>
                        <span>Start Chat on WhatsApp</span>
                    </a>
                </div>
            </div>
            
            <!-- Floating Button Trigger -->
            <button class="whatsapp-trigger-btn" id="whatsappTriggerBtn" aria-label="Open WhatsApp Chat">
                <div class="pulse-ring"></div>
                <span class="whatsapp-tooltip" id="whatsappTooltip">Need help? Chat with us!</span>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.37 5.048L2 22l5.09-1.332a9.929 9.929 0 004.919 1.29c5.507 0 9.99-4.478 9.99-9.984 0-2.67-1.04-5.178-2.927-7.064S14.686 2 12.012 2zm5.842 14.15c-.246.695-1.436 1.306-1.97 1.365-.487.054-1.12.078-2.527-.478a10.024 10.024 0 01-4.32-3.805c-.888-1.214-1.572-2.628-1.572-4.09 0-1.552.812-2.316 1.102-2.611.23-.23.51-.342.744-.342.078 0 .15.004.215.008.204.01.408.016.586.398.225.485.768 1.87.835 2.008.067.138.112.298.02.482-.09.184-.136.298-.27.46-.135.163-.284.364-.407.49-.138.143-.28.3-.122.573.16.27.7 1.15 1.502 1.861.802.71 1.48.93 1.69 1.023.21.092.336.078.462-.06.127-.14.542-.63.687-.847.143-.217.288-.183.487-.11.2.074 1.27.6 1.488.71.217.11.362.16.417.253.054.093.054.542-.192 1.237z"/>
                </svg>
            </button>
        `;
        
        document.body.appendChild(widgetContainer);
        
        const chatBox = document.getElementById('whatsappChatBox');
        const triggerBtn = document.getElementById('whatsappTriggerBtn');
        const closeBtn = document.getElementById('whatsappCloseBtn');
        const tooltip = document.getElementById('whatsappTooltip');
        
        const toggleChat = (e) => {
            if (e) {
                e.stopPropagation();
            }
            const isOpen = chatBox.classList.contains('active');
            if (isOpen) {
                chatBox.classList.remove('active');
                chatBox.setAttribute('aria-hidden', 'true');
            } else {
                chatBox.classList.add('active');
                chatBox.setAttribute('aria-hidden', 'false');
                tooltip.classList.add('hidden'); // Hide tooltip permanently when chat is opened
            }
        };
        
        triggerBtn.addEventListener('click', toggleChat);
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chatBox.classList.remove('active');
            chatBox.setAttribute('aria-hidden', 'true');
        });
        
        // Hide tooltip on hover of trigger button or after delay
        triggerBtn.addEventListener('mouseenter', () => {
            tooltip.classList.add('hidden');
        });
        
        // Auto-show tooltip after 3.5 seconds
        setTimeout(() => {
            if (!chatBox.classList.contains('active') && !tooltip.classList.contains('hidden')) {
                tooltip.classList.add('visible');
            }
        }, 3500);
        
        // Auto-hide tooltip after 9.5 seconds
        setTimeout(() => {
            tooltip.classList.remove('visible');
            tooltip.classList.add('hidden');
        }, 9500);
        
        // Close chat box when clicking outside of it
        document.addEventListener('click', (e) => {
            if (!widgetContainer.contains(e.target) && chatBox.classList.contains('active')) {
                chatBox.classList.remove('active');
                chatBox.setAttribute('aria-hidden', 'true');
            }
        });
        
        // Prevent closing chat box when clicking inside it
        chatBox.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Auto popup once per session after 8 seconds
        if (!sessionStorage.getItem('wa-popup-shown')) {
            setTimeout(() => {
                if (!chatBox.classList.contains('active')) {
                    chatBox.classList.add('active');
                    chatBox.setAttribute('aria-hidden', 'false');
                    sessionStorage.setItem('wa-popup-shown', 'true');
                }
            }, 8000);
        }
    };
    
    // --- Load Home Services Section (What We Do Best) ---
    const loadHomeServices = async () => {
        const grid = document.getElementById('homeServicesGrid');
        if (!grid) return;

        try {
            const res = await fetch('/api/home-services');
            if (!res.ok) return;
            const services = await res.json();

            if (!Array.isArray(services) || services.length === 0) return;

            grid.innerHTML = '';
            if (services.length <= 2) {
                grid.classList.add('center-layout');
            } else {
                grid.classList.remove('center-layout');
            }

            services.forEach(item => {
                const card = document.createElement('div');
                card.className = `service-card ${item.is_featured ? 'featured' : ''}`;
                
                card.innerHTML = `
                    <div class="service-icon">
                        ${item.icon_svg}
                    </div>
                    <h3 class="headline-sm">${item.title}</h3>
                    <p class="body-md">${item.description}</p>
                    <a class="service-link" href="/services">Read More</a>
                `;
                grid.appendChild(card);
            });
        } catch (err) {
            console.warn('Dynamic home services load failed, preserving static HTML:', err);
        }
    };

    // --- Load Testimonials Section ---
    const loadTestimonials = async () => {
        const grid = document.getElementById('testimonialsGrid');
        if (!grid) return;

        try {
            const res = await fetch('/api/testimonials');
            if (!res.ok) return;
            const items = await res.json();
            if (!Array.isArray(items) || items.length === 0) return;

            grid.innerHTML = items.map(item => `
                <div class="testimonial-card">
                    <div class="quote-icon">
                        <svg viewBox="0 0 32 32">
                            <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H6c0-2.2 1.8-4 4-4V8zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-8c0-2.2 1.8-4 4-4V8z" fill="currentColor" />
                        </svg>
                    </div>
                    <p class="body-md testimonial-text">"${item.quote || ''}"</p>
                    <div style="color: var(--color-warning); font-size: 14px; margin: 6px 0 14px;">${'★'.repeat(item.rating || 5)}</div>
                    <div class="testimonial-author">
                        <div class="author-img">
                            <img alt="${item.name || 'Client'} portrait" src="${item.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'" />
                        </div>
                        <div class="author-details">
                            <h4>${item.name || 'Client'}</h4>
                            <p>${item.role || ''}</p>
                        </div>
                    </div>
                </div>
            `).join('');

            if (typeof startTestimonialAutoplay === 'function') {
                startTestimonialAutoplay();
            }
        } catch (err) {
            console.warn('Dynamic testimonials load failed, preserving static HTML:', err);
        }
    };

    loadHomeServices();
    loadTestimonials();
    initWhatsAppWidget();

    // Fetch Promotion Settings
    (async () => {
        try {
            const res = await fetch('/api/promotion');
            const promo = await res.json();
            if (promo && promo.is_active) {
                const bar = document.getElementById('promotionBar');
                const marquee = document.getElementById('promotionMarquee');
                
                // Fill marquee with enough copies to prevent blank space
                const innerHtml = `
                    <span class="promo-text-node">${promo.text}</span>
                    <a href="#" class="promo-link-node promotion-bar-btn">${promo.link_text || "Today's Exclusive Pricing"}</a>
                `;
                let marqueeHtml = '';
                for (let i = 0; i < 20; i++) {
                    marqueeHtml += `<div class="promotion-bar-inner" ${i > 0 ? 'aria-hidden="true"' : ''}>${innerHtml}</div>`;
                }
                marquee.innerHTML = marqueeHtml;

                const linkNodes = marquee.querySelectorAll('.promo-link-node');
                
                const speed = promo.speed || 15;
                marquee.style.animationDuration = `${speed * 10}s`;
                
                bar.style.display = 'flex';
                document.body.classList.add('has-promo-bar');

                const popupConfig = (promo.popup || {});
                const popupEnabled = !!popupConfig.enabled;

                const openPromoPopup = () => {
                    const overlay = document.getElementById('promoPopup');
                    const img = document.getElementById('promoPopupImage');
                    const mobileSource = document.getElementById('promoPopupMobileSource');
                    const link = document.getElementById('promoPopupLink');
                    if (!overlay || !img) return;

                    const isMobile = window.matchMedia('(max-width: 768px)').matches;
                    const imageUrl = isMobile ? (popupConfig.mobile_image || popupConfig.desktop_image) : (popupConfig.desktop_image || popupConfig.mobile_image);
                    if (!imageUrl) return;

                    img.src = imageUrl;
                    if (mobileSource && popupConfig.mobile_image && popupConfig.desktop_image) {
                        mobileSource.srcset = popupConfig.mobile_image;
                    }
                    link.href = popupConfig.link_url || '#';

                    overlay.style.display = 'flex';
                    requestAnimationFrame(() => overlay.classList.add('active'));
                };

                if (popupEnabled) {
                    linkNodes.forEach(el => {
                        el.removeAttribute('href');
                        el.style.cursor = 'pointer';
                        el.addEventListener('click', (e) => {
                            e.preventDefault();
                            openPromoPopup();
                        });
                    });
                } else {
                    linkNodes.forEach(el => {
                        el.href = promo.link_url || '#';
                    });
                }

                // Handle floating offer image
                if (promo.floating_image_active === 1 && promo.floating_image_url) {
                    const modal = document.createElement('div');
                    modal.className = 'floating-offer-overlay';
                    modal.innerHTML = `
                        <div class="floating-offer-modal">
                            <button class="floating-offer-close">&times;</button>
                            <a href="${promo.link_url || '#'}">
                                <picture>
                                    ${promo.floating_image_url_mobile ? `<source media="(max-width: 768px)" srcset="${promo.floating_image_url_mobile}">` : ''}
                                    <img src="${promo.floating_image_url}" alt="Special Offer">
                                </picture>
                            </a>
                        </div>
                    `;
                    document.body.appendChild(modal);

                    const closeModal = (e) => {
                        if (e) e.preventDefault();
                        modal.classList.remove('active');
                    };

                    const openModal = (e) => {
                        if (e) e.preventDefault();
                        modal.classList.add('active');
                    };

                    modal.querySelector('.floating-offer-close').addEventListener('click', closeModal);
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) closeModal();
                    });

                    // Show on load
                    setTimeout(openModal, 1000);

                    // Override promotion bar links
                    linkNodes.forEach(el => {
                        el.href = '#';
                        el.addEventListener('click', openModal);
                    });
                } else {
                    linkNodes.forEach(el => {
                        el.href = promo.link_url || '#';
                    });
                }
            }
        } catch(err) {
            console.warn('Promotion bar failed to load:', err);
        }
    })();

    // Show promo popup once per user
    (async () => {
        try {
            const res = await fetch('/api/promotion');
            const promo = await res.json();
            const popup = (promo.popup || {});
            if (!popup.enabled) return;

            const overlay = document.getElementById('promoPopup');
            const img = document.getElementById('promoPopupImage');
            const mobileSource = document.getElementById('promoPopupMobileSource');
            const link = document.getElementById('promoPopupLink');
            const closeBtn = document.getElementById('promoPopupClose');

            if (!overlay || !img) return;

            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            const imageUrl = isMobile ? (popup.mobile_image || popup.desktop_image) : (popup.desktop_image || popup.mobile_image);
            if (!imageUrl) return;

            const dismiss = () => {
                overlay.classList.remove('active');
                setTimeout(() => { overlay.style.display = 'none'; }, 300);
                localStorage.setItem('promoPopupDismissed', 'true');
            };

            closeBtn.addEventListener('click', (e) => { e.preventDefault(); dismiss(); });
            overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });

            if (!localStorage.getItem('promoPopupDismissed')) {
                img.src = imageUrl;
                if (mobileSource && popup.mobile_image && popup.desktop_image) {
                    mobileSource.srcset = popup.mobile_image;
                }
                link.href = popup.link_url || '#';
                overlay.style.display = 'flex';
                requestAnimationFrame(() => overlay.classList.add('active'));
            }
        } catch (err) {
            console.warn('Promo popup failed to load:', err);
        }
    })();
});


// --- Global Settings Hydration ---
async function loadGlobalDynamicSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        
        if (data.contact) {
            const addressEls = document.querySelectorAll('.maps-address');
            addressEls.forEach(el => el.textContent = data.contact.address || '');
            
            const linkEls = document.querySelectorAll('.maps-link');
            linkEls.forEach(el => el.href = data.contact.mapLink || '#');
            
            const iframeEls = document.querySelectorAll('.maps-iframe');
            iframeEls.forEach(el => {
                const q = data.contact.coords || data.contact.address || '';
                const z = data.contact.zoom || 14;
                el.src = 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&t=&z=' + z + '&ie=UTF8&iwloc=&output=embed';
            });
        }
        
        if (data.general) {
            const g = data.general;
            
            // Client-side guard for deployment status and maintenance mode across all pages
            const isNotAdmin = !window.location.pathname.startsWith('/admin');
            if (isNotAdmin) {
                if (g.isDeployed === false && !window.location.pathname.includes('coming-soon')) {
                    window.location.href = '/coming-soon';
                    return;
                }
                if (g.maintenance === true && !window.location.pathname.includes('maintenance')) {
                    window.location.href = '/maintenance';
                    return;
                }
            }
            
            if (g.siteName) {
                document.title = g.siteName + ' | Digital Agency & Technology Solutions';
                document.querySelectorAll('.footer-logo span').forEach(el => el.textContent = g.siteName);
            }
            if (g.tagline) {
                const taglineEls = document.querySelectorAll('.footer-desc');
                taglineEls.forEach(el => el.textContent = g.tagline);
            }
            if (g.description) {
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc) metaDesc.setAttribute('content', g.description);
            }
        }
        
        if (data.media) {
            const getYoutubeId = (url) => {
                if (!url) return '';
                if (url.includes('youtube.com/watch?v=')) return url.split('v=')[1].split('&')[0];
                if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split('?')[0];
                return '';
            };

            const renderSectionMedia = (section, containerSelector) => {
                const cfg = data.media[section];
                if (!cfg) return;

                const container = document.querySelector(containerSelector);
                if (!container) return;

                const imageUrl = cfg.image || '';
                const videoUrl = cfg.video || '';
                const videoType = cfg.videoType || '';
                const autoplay = cfg.autoplay !== false;
                const showImage = cfg.showImage !== false;

                let mediaHtml = '';

                if (videoUrl && videoType === 'youtube') {
                    const videoId = getYoutubeId(videoUrl);
                    if (videoId) {
                        const params = autoplay
                            ? '?autoplay=1&mute=1&loop=1&playlist=' + videoId + '&controls=0&showinfo=0&rel=0'
                            : '?controls=1';
                        mediaHtml = `<iframe src="https://www.youtube.com/embed/${videoId}${params}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"></iframe>`;
                    }
                } else if (videoUrl && videoType === 'video') {
                    const attrs = autoplay ? 'autoplay muted loop playsinline' : 'controls';
                    mediaHtml = `<video ${attrs} style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border:0;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"><source src="${videoUrl}" type="video/mp4"></video>`;
                }

                if (showImage && imageUrl) {
                    mediaHtml += `<img src="${imageUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" class="media-fallback-img" onerror="this.style.display='none'">`;
                }

                if (mediaHtml) {
                    container.style.position = 'relative';
                    let bgDiv = container.querySelector('.video-bg');
                    if (!bgDiv) {
                        bgDiv = document.createElement('div');
                        bgDiv.className = 'video-bg';
                        bgDiv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden;';
                        container.insertBefore(bgDiv, container.firstChild);
                    }
                    bgDiv.innerHTML = mediaHtml;
                }
            };

            renderSectionMedia('how_we_work', '[data-media-section="how_we_work"]');
            renderSectionMedia('our_agency', '[data-media-section="our_agency"]');
            renderSectionMedia('our_journey', '[data-media-section="our_journey"]');
            renderSectionMedia('methodology', '[data-media-section="methodology"]');
        }
        
        // Social links are rendered by js/socials.js (single source of truth)
    } catch(e) { console.error('Failed to load global settings', e); }
}

document.addEventListener('DOMContentLoaded', loadGlobalDynamicSettings);


// --- Legal Modal Logic ---
const legalData = {
    terms: `
<h2>Effective Date: July 14, 2026</h2>
<p>Welcome to AS Creates. By accessing or using our website and services, you agree to comply with these Terms & Conditions. If you do not agree with these terms, please do not use our services.</p>
<h2>1. About Us</h2>
<p>AS Creates is a digital agency providing services including but not limited to:</p>
<ul>
    <li>Website Design & Development</li>
    <li>UI/UX Design</li>
    <li>SEO Services</li>
    <li>Digital Marketing</li>
    <li>Branding</li>
    <li>AI Solutions</li>
    <li>Website Maintenance</li>
    <li>Graphic Design</li>
</ul>
<h2>2. Service Agreement</h2>
<p>All projects begin only after both parties agree on the project scope, timeline, pricing, and payment terms.</p>
<p>Any additional work requested outside the agreed scope may incur additional charges.</p>
<h2>3. Payments</h2>
<ul>
    <li>Payments are made according to the agreed quotation or invoice.</li>
    <li>Projects may require an advance payment before work begins.</li>
    <li>Final files or deployment may be withheld until the outstanding balance has been paid.</li>
    <li>Payments made are generally non-refundable once work has commenced unless otherwise agreed in writing.</li>
</ul>
<h2>4. Client Responsibilities</h2>
<p>Clients agree to:</p>
<ul>
    <li>Provide accurate project requirements.</li>
    <li>Supply necessary content, images, branding materials, and credentials.</li>
    <li>Review submitted work within a reasonable timeframe.</li>
    <li>Respond promptly to communication requests.</li>
</ul>
<p>Project delays caused by the client may extend delivery timelines.</p>
<h2>5. Intellectual Property</h2>
<p>Unless otherwise agreed:</p>
<ul>
    <li>Clients receive ownership of the final deliverables after full payment.</li>
    <li>AS Creates retains the right to display completed work in its portfolio and marketing materials.</li>
    <li>Third-party software, plugins, fonts, or licensed assets remain subject to their respective licenses.</li>
</ul>
<h2>6. Revisions</h2>
<p>Revision limits are determined by the selected package or proposal. Requests beyond the included revisions may be billed separately.</p>
<h2>7. Website Hosting & Third-Party Services</h2>
<p>AS Creates is not responsible for outages, policy changes, pricing updates, or service interruptions caused by third-party providers including hosting companies, domain registrars, payment gateways, APIs, or cloud services.</p>
<h2>8. Limitation of Liability</h2>
<p>AS Creates shall not be liable for indirect, incidental, special, or consequential damages arising from the use of our services or website.</p>
<h2>9. Project Cancellation</h2>
<p>Either party may terminate a project with written notice. Work completed up to the cancellation date shall remain billable.</p>
<h2>10. Privacy</h2>
<p>Your use of our services is also governed by our Privacy Policy.</p>
<h2>11. Changes to These Terms</h2>
<p>We reserve the right to modify these Terms at any time. Updated versions will be posted on this page.</p>
<h2>12. Contact</h2>
<p>For any questions regarding these Terms, please contact AS Creates through the contact information available on our website.</p>`,

    
    billing: `
<h2>Effective Date: July 14, 2026</h2>
<p>This Billing & Payment Policy outlines the payment terms for all services provided by <strong>AS Creates</strong>. By engaging our services, you agree to comply with the terms stated below.</p>
<h2>1. General</h2>
<p>This Billing & Payment Policy outlines the payment terms for all services provided by <strong>AS Creates</strong>. By engaging our services, you agree to comply with the terms stated below.</p>
<h2>2. Pricing</h2>
<ul>
    <li>All prices are quoted in the agreed currency (INR, USD, EUR, or any other mutually agreed currency).</li>
    <li>Custom projects are priced based on project scope, complexity, and estimated development time.</li>
    <li>Prices are subject to change until a formal quotation or invoice has been accepted.</li>
</ul>
<h2>3. Payment Schedule</h2>
<ul>
    <li>A minimum <strong>50% advance payment</strong> is required before work begins.</li>
    <li>The remaining balance must be paid before the final website, application, or project files are delivered unless otherwise agreed in writing.</li>
    <li>Larger projects may follow milestone-based payments as outlined in the project proposal.</li>
</ul>
<h2>4. Accepted Payment Methods</h2>
<p>We accept payments through approved payment methods, including:</p>
<ul>
    <li>Bank Transfer</li>
    <li>UPI</li>
    <li>PayPal</li>
    <li>Wise</li>
    <li>Stripe (where available)</li>
    <li>Other mutually agreed payment methods</li>
</ul>
<h2>5. Currency</h2>
<p>International clients may pay in their preferred supported currency. Any currency conversion fees or intermediary bank charges are the responsibility of the client unless otherwise agreed.</p>
<h2>6. Invoices</h2>
<ul>
    <li>An invoice will be issued for every payment.</li>
    <li>Clients should verify invoice details before making payment.</li>
    <li>Payment confirmation may take up to 3 business days depending on the payment method.</li>
</ul>
<h2>7. Late Payments</h2>
<ul>
    <li>Payments not received by the agreed due date may result in project suspension.</li>
    <li>Delivery of the project may be delayed until outstanding payments are cleared.</li>
    <li>AS Creates reserves the right to charge reasonable late payment fees where permitted by applicable law.</li>
</ul>
<h2>8. Taxes</h2>
<p>Any applicable taxes, duties, or government charges are the responsibility of the client unless otherwise stated in the quotation or invoice.</p>
<h2>9. Refunds</h2>
<p>Refund requests are governed by our separate <strong>Refund & Cancellation Policy</strong>. Payments for completed work, delivered milestones, third-party services, domain registrations, hosting, software licenses, and other non-refundable expenses cannot be refunded.</p>
<h2>10. Project Suspension</h2>
<p>If payment is overdue, AS Creates may:</p>
<ul>
    <li>Pause ongoing work.</li>
    <li>Delay project delivery.</li>
    <li>Suspend support or maintenance services.</li>
    <li>Restrict access to project deliverables until outstanding balances are paid.</li>
</ul>
<h2>11. Ownership of Work</h2>
<p>Ownership of the completed project, including source files, website code, graphics, and related assets, transfers to the client only after full payment has been received unless otherwise specified in the service agreement.</p>
<h2>12. Third-Party Costs</h2>
<p>Clients are responsible for all third-party expenses, including but not limited to:</p>
<ul>
    <li>Domain registration</li>
    <li>Web hosting</li>
    <li>Premium plugins</li>
    <li>Premium themes</li>
    <li>Stock media</li>
    <li>Software licenses</li>
    <li>External APIs</li>
    <li>Cloud services</li>
</ul>
<p>These costs are separate from development fees unless explicitly included in the quotation.</p>
<h2>13. Subscription & Maintenance Services</h2>
<p>For recurring services:</p>
<ul>
    <li>Payments are billed according to the selected plan.</li>
    <li>Failure to make timely payments may result in suspension or termination of the service.</li>
    <li>Services may be restored after outstanding payments have been settled.</li>
</ul>
<h2>14. Chargebacks</h2>
<p>Clients agree to contact AS Creates to resolve any payment disputes before initiating a chargeback. Fraudulent or unjustified chargebacks may result in immediate suspension of services and legal action where applicable.</p>
<h2>15. Payment Security</h2>
<p>AS Creates does not store or process sensitive payment card information directly. Payments are handled through trusted third-party payment providers.</p>
<h2>16. Changes to This Policy</h2>
<p>AS Creates reserves the right to modify this Billing & Payment Policy at any time. Updated versions will be published on this page with the revised effective date.</p>
<h2>17. Contact</h2>
<p>For any questions regarding billing or payments, please contact us through our official support channels listed on our Contact page.</p>`,
    privacy: `
<h2>Effective Date: July 14, 2026</h2>
<p>AS Creates values your privacy. This Privacy Policy explains how we collect, use, and protect your information.</p>
<h2>Information We Collect</h2>
<p>We may collect:</p>
<ul>
    <li>Name</li>
    <li>Email address</li>
    <li>Phone number</li>
    <li>Company information</li>
    <li>Billing details</li>
    <li>Messages submitted through contact forms</li>
    <li>Project requirements</li>
    <li>Website analytics and usage data</li>
    <li>Cookies and device information</li>
</ul>
<h2>How We Use Your Information</h2>
<p>We use your information to:</p>
<ul>
    <li>Respond to enquiries</li>
    <li>Deliver requested services</li>
    <li>Process invoices and payments</li>
    <li>Improve our website</li>
    <li>Provide customer support</li>
    <li>Send important project updates</li>
    <li>Prevent fraud and abuse</li>
</ul>
<h2>Cookies</h2>
<p>Our website may use cookies to improve user experience, analyze website traffic, and remember user preferences.</p>
<p>You may disable cookies through your browser settings.</p>
<h2>Data Sharing</h2>
<p>We do not sell your personal information.</p>
<p>We may share information only with trusted third-party providers when necessary, including:</p>
<ul>
    <li>Payment processors</li>
    <li>Hosting providers</li>
    <li>Analytics providers</li>
    <li>Email service providers</li>
</ul>
<h2>Data Security</h2>
<p>We implement reasonable security measures to protect your information. However, no online system can guarantee absolute security.</p>
<h2>Data Retention</h2>
<p>We retain your information only as long as necessary to provide our services or comply with legal obligations.</p>
<h2>Your Rights</h2>
<p>Depending on your location, you may have the right to:</p>
<ul>
    <li>Access your information</li>
    <li>Correct inaccurate information</li>
    <li>Request deletion</li>
    <li>Withdraw consent where applicable</li>
</ul>
<h2>External Links</h2>
<p>Our website may contain links to third-party websites. We are not responsible for their privacy practices.</p>
<h2>Updates</h2>
<p>This Privacy Policy may be updated periodically. Continued use of our website constitutes acceptance of the updated policy.</p>
<h2>Contact</h2>
<p>For privacy-related questions, please contact AS Creates.</p>`,

    legal: `
<p>The information provided on the AS Creates website is for general informational purposes only.</p>
<p>While we strive to ensure all information is accurate and current, we make no warranties regarding the completeness, reliability, or accuracy of the information provided.</p>
<p>AS Creates is not responsible for any losses, damages, or business interruptions resulting from the use of our website, services, third-party tools, hosting providers, APIs, or external websites.</p>
<p>Any links to third-party websites are provided solely for convenience. AS Creates does not endorse or assume responsibility for their content or services.</p>
<p>All trademarks, logos, and brand names displayed belong to their respective owners.</p>
<p>Unauthorized copying, reproduction, redistribution, or commercial use of website content without written permission from AS Creates is prohibited.</p>
<p>Use of this website constitutes acceptance of this disclaimer.</p>`
};

function initLegalModal() {
    const modalHtml = `
    <div class="legal-modal" id="legalModal">
        <div class="legal-modal-content" onclick="event.stopPropagation()">
            <div class="legal-modal-header">
                <h2 id="legalModalTitle">Terms & Conditions</h2>
                <button class="legal-modal-close" id="legalModalClose">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="legal-modal-body" id="legalModalBody"></div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('legalModal');
    const closeBtn = document.getElementById('legalModalClose');
    const title = document.getElementById('legalModalTitle');
    const body = document.getElementById('legalModalBody');

    const closeModal = () => modal.classList.remove('active');
    
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', closeModal);

    // Attach to links
    const footerLinks = document.querySelectorAll('.footer-links-col a, a.legal-link, .footer-bottom-links a');
    footerLinks.forEach(link => {
        const text = link.textContent.trim().toLowerCase();
        if (text.includes('billing') || text.includes('payment')) {
            link.href = '#';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                title.textContent = 'Billing & Payment Policy';
                body.innerHTML = legalData.billing;
                modal.classList.add('active');
            });
        } else if (text.includes('privacy') || text.includes('policies')) {
            link.href = '#';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                title.textContent = 'Privacy Policy';
                body.innerHTML = legalData.privacy;
                modal.classList.add('active');
            });
        } else if (text.includes('terms')) {
            link.href = '#';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                title.textContent = 'Terms & Conditions';
                body.innerHTML = legalData.terms;
                modal.classList.add('active');
            });
        } else if (text.includes('legal') || text.includes('disclaimer')) {
            link.href = '#';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                title.textContent = 'Legal Disclaimer';
                body.innerHTML = legalData.legal;
                modal.classList.add('active');
            });
        }
    });
}
document.addEventListener('DOMContentLoaded', initLegalModal);


// --- YouTube Video / Image Section Hydration Helper ---
window.getYouTubeEmbedUrl = function(url) {
    if (!url) return null;
    let videoId = '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        videoId = match[2];
    } else {
        if (url.trim().length === 11) {
            videoId = url.trim();
        }
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
};

window.hydrateSectionImage = function(elementId, imageData) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (imageData && imageData.youtube_url && imageData.youtube_url.trim()) {
        const embedUrl = window.getYouTubeEmbedUrl(imageData.youtube_url);
        if (embedUrl) {
            const wrapper = el.parentElement;
            if (wrapper) {
                if (el.tagName.toLowerCase() === 'img') {
                    const iframe = document.createElement('iframe');
                    iframe.id = elementId;
                    iframe.src = embedUrl;
                    iframe.title = imageData.title || 'Video';
                    iframe.frameBorder = '0';
                    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
                    iframe.allowFullscreen = true;
                    iframe.className = el.className + ' w-full h-full aspect-video';
                    iframe.style.cssText = el.style.cssText + '; width: 100%; height: 100%; border: none; min-height: 250px;';
                    wrapper.replaceChild(iframe, el);
                } else if (el.tagName.toLowerCase() === 'iframe') {
                    el.src = embedUrl;
                }
                return;
            }
        }
    }
    
    if (imageData) {
        if (el.tagName.toLowerCase() === 'iframe') {
            const wrapper = el.parentElement;
            if (wrapper) {
                const img = document.createElement('img');
                img.id = elementId;
                img.src = imageData.url;
                img.alt = imageData.alt;
                img.className = el.className.replace('aspect-video', '');
                img.style.cssText = el.style.cssText.replace('border: none; min-height: 250px;', '');
                wrapper.replaceChild(img, el);
            }
        } else {
            el.src = imageData.url || '';
            if (imageData.alt) {
                el.alt = imageData.alt;
            }

            if (imageData.images && imageData.images.length > 0) {
                const wrapper = el.parentElement;
                if (wrapper && wrapper.classList.contains('process-image-inner')) {
                    const existingSlides = wrapper.querySelectorAll('.carousel-slide');
                    existingSlides.forEach(slide => {
                        if (slide.id !== elementId) {
                            slide.remove();
                        }
                    });
                    
                    imageData.images.forEach(imgUrl => {
                        if (!imgUrl) return;
                        const slide = document.createElement('img');
                        slide.src = imgUrl;
                        slide.alt = imageData.alt || 'Carousel slide';
                        slide.className = 'carousel-slide';
                        wrapper.appendChild(slide);
                    });

                    if (wrapper._carouselInterval) clearInterval(wrapper._carouselInterval);
                    const slides = wrapper.querySelectorAll('.carousel-slide');
                    if (slides.length > 1) {
                        let current = 0;
                        slides.forEach(s => s.classList.remove('active'));
                        slides[0].classList.add('active');
                        wrapper._carouselInterval = setInterval(() => {
                            slides[current].classList.remove('active');
                            current = (current + 1) % slides.length;
                            slides[current].classList.add('active');
                        }, 3500);
                    }
                }
            }
        }
    }
};

// Mobile horizontal scroll hint
document.addEventListener('DOMContentLoaded', () => {
    const horizontalGrids = document.querySelectorAll('.services-grid, .features-grid, .team-grid, .value-grid, .services-detail-grid, .blog-gallery-grid, .portfolio-grid');
    if (horizontalGrids.length > 0 && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && window.innerWidth <= 768) {
                    const grid = entry.target;
                    if (grid.scrollWidth > grid.clientWidth) {
                        setTimeout(() => {
                            grid.scrollBy({ left: 80, behavior: 'smooth' });
                            setTimeout(() => {
                                grid.scrollBy({ left: -80, behavior: 'smooth' });
                            }, 400);
                        }, 1000);
                    }
                    observer.unobserve(grid);
                }
            });
        }, { threshold: 0.5 });
        
        horizontalGrids.forEach(grid => observer.observe(grid));
    }
});

// Global Animate on Scroll
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll('section, .card, .portfolio-card, .founder-card, .testimonial-card, h1, h2, .step-item, .process-info, .agency-content, .hero-content, .pov-box, .service-card, .btn');
    
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            let delayCount = 0;
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    // Stagger elements appearing at the same time
                    setTimeout(() => {
                        entry.target.classList.add('is-visible');
                    }, delayCount * 100); 
                    delayCount++;
                    observer.unobserve(entry.target);
                }
            });
            // Reset delay counter for next batch
            setTimeout(() => { delayCount = 0; }, 100);
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        
        animateElements.forEach(el => {
            // Don't animate elements inside already animated parents unless specifically needed, to avoid double jumping
            // We'll apply it globally
            if (!el.classList.contains('animate-on-scroll')) {
                el.classList.add('animate-on-scroll');
            }
            observer.observe(el);
        });
    } else {
        animateElements.forEach(el => {
            if (!el.classList.contains('animate-on-scroll')) {
                el.classList.add('animate-on-scroll');
            }
            el.classList.add('is-visible');
        });
    }
});
