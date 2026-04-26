// ============================================
// LÓGICA DE LA PÁGINA DE LOGIN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Detectar si estamos en la página de login o dashboard
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        initializeLoginPage();
    } else {
        initializeDashboard();
    }
});

// ============================================
// FUNCIONES PARA LOGIN
// ============================================
function initializeLoginPage() {
    const loginForm = document.getElementById('loginForm');

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Validar que los campos no estén vacíos
        if (!username || !password) {
            showAlert('Por favor completa todos los campos', 'error');
            return;
        }

        // Simulación de login (en producción, enviar a servidor)
        console.log('Login attempt:', { username, password });
        
        // Guardar sesión simulada
        localStorage.setItem('user', JSON.stringify({ 
            username, 
            loginTime: new Date().toISOString() 
        }));

        // Mostrar mensaje de éxito
        showAlert('¡Bienvenido! Redirigiendo...', 'success');

        // Redirigir al dashboard después de 1 segundo
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1000);
    });

    // Agregar efecto visual en inputs
    const inputs = document.querySelectorAll('.login-form input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'translateY(-2px)';
        });

        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'translateY(0)';
        });
    });
}

// ============================================
// FUNCIONES PARA DASHBOARD
// ============================================
function initializeDashboard() {
    // Verificar si el usuario está autenticado
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    // Inicializar menú de navegación
    initializeNavigation();

    // Inicializar menú de usuario
    initializeUserMenu();

    // Inicializar tarjetas clickeables
    initializeClickableCards();

    // Inicializar datos simulados
    initializeSimulatedData();
}

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    const pages = document.querySelectorAll('.page');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const pageId = this.getAttribute('data-page');
            
            // Remover clase active de todos los items
            navItems.forEach(i => i.classList.remove('active'));
            
            // Remover clase active de todas las páginas
            pages.forEach(p => p.classList.remove('active'));

            // Agregar clase active al item clickeado
            this.classList.add('active');

            // Mostrar la página correspondiente
            const pageElement = document.getElementById(`${pageId}-page`);
            if (pageElement) {
                pageElement.classList.add('active');
            }

            // Guardar última página visitada
            localStorage.setItem('lastPage', pageId);
        });
    });

    // Cargar la última página visitada
    const lastPage = localStorage.getItem('lastPage') || 'home';
    const lastPageItem = document.querySelector(`.nav-item[data-page="${lastPage}"]`);
    if (lastPageItem) {
        lastPageItem.click();
    }
}

function initializeUserMenu() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    // Toggle dropdown
    userMenuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        userDropdown.classList.toggle('active');
    });

    // Cerrar dropdown al hacer click afuera
    document.addEventListener('click', function(e) {
        if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
    });

    // Cerrar sesión
    logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Limpiar localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('lastPage');

        // Redirigir a login
        window.location.href = '/index.html';
    });

    // Actualizar nombre de usuario
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = user.username.charAt(0).toUpperCase() + user.username.slice(1);
        }

        // Actualizar avatar con iniciales
        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar) {
            const initials = user.username.substring(0, 2).toUpperCase();
            userAvatar.textContent = initials;
        }
    }
}

function initializeClickableCards() {
    const clickableCards = document.querySelectorAll('.card-clickable');

    clickableCards.forEach(card => {
        card.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            const navItem = document.querySelector(`.nav-item[data-page="${action}"]`);
            
            if (navItem) {
                navItem.click();
            }
        });
    });
}

function initializeSimulatedData() {
    // Simular actualización de datos en tiempo real
    setInterval(updateSimulatedMetrics, 3000);
}

function updateSimulatedMetrics() {
    // Actualizar métricas de equipos críticos
    const metrics = document.querySelectorAll('.metric-fill');

    metrics.forEach(metric => {
        // Generar variación pequeña en los valores
        const currentWidth = parseFloat(metric.style.width);
        const variation = (Math.random() - 0.5) * 10;
        const newWidth = Math.max(0, Math.min(100, currentWidth + variation));
        
        metric.style.width = newWidth + '%';
    });

    // Ocasionalmente cambiar estado de algunos equipos (simulación)
    if (Math.random() > 0.95) {
        const statuses = document.querySelectorAll('.status');
        if (statuses.length > 0) {
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            // Cambio visual sin afectar permanentemente
        }
    }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function showAlert(message, type = 'info') {
    // Crear elemento de alerta
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 2000;
        animation: slideIn 0.3s ease-out;
    `;

    // Aplicar estilos según el tipo
    const colors = {
        success: '#27ae60',
        error: '#e74c3c',
        warning: '#f39c12',
        info: '#0099ff'
    };

    alert.style.backgroundColor = colors[type] || colors.info;
    alert.style.color = 'white';

    document.body.appendChild(alert);

    // Remover alerta después de 3 segundos
    setTimeout(() => {
        alert.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => {
            alert.remove();
        }, 300);
    }, 3000);
}

// Agregar animaciones CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ============================================
// MANEJO DE ERRORES GLOBALES
// ============================================
window.addEventListener('error', function(event) {
    console.error('Error global:', event.error);
    showAlert('Ocurrió un error inesperado', 'error');
});

// ============================================
// API HELPER (para futuras conexiones al backend)
// ============================================
const API = {
    baseURL: 'http://localhost:3000/api',

    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            showAlert('Error al conectar con el servidor', 'error');
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

// Ejemplo de uso futuro:
// API.get('/equipment').then(data => console.log(data));
