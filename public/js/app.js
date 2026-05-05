const API = {
    getUserId() {
        const user = getCurrentUser();
        return user?.id;
    },

    getHeaders(includeJson = false) {
        const headers = {};
        const userId = this.getUserId();

        if (includeJson) {
            headers['Content-Type'] = 'application/json';
        }

        if (userId) {
            headers['x-user-id'] = userId;
        }

        return headers;
    },

    async request(url, options = {}) {
        const response = await fetch(url, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Error en la petición');
        }

        return result;
    },

    get(url) {
        return this.request(url, {
            headers: this.getHeaders()
        });
    },

    post(url, data) {
        return this.request(url, {
            method: 'POST',
            headers: this.getHeaders(true),
            body: JSON.stringify(data)
        });
    },

    put(url, data) {
        return this.request(url, {
            method: 'PUT',
            headers: this.getHeaders(true),
            body: JSON.stringify(data)
        });
    }
};

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('user') || 'null');
}

function showAlert(message, type = 'info') {
    document.querySelector('.app-alert')?.remove();

    const alert = document.createElement('div');
    alert.className = `app-alert app-alert-${type}`;
    alert.textContent = message;
    document.body.appendChild(alert);

    setTimeout(() => alert.remove(), 3000);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function initLogin() {
    const loginForm = document.getElementById('loginForm');

    if (!loginForm) {
        return;
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
            const data = await API.post('/api/login', {
                username: document.getElementById('username').value.trim(),
                password: document.getElementById('password').value
            });

            localStorage.setItem('user', JSON.stringify(data.user));
            showAlert('Bienvenido', 'success');

            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 700);
        } catch (error) {
            showAlert(error.message || 'Usuario o contraseña incorrectos', 'error');
        }
    });
}

function initDashboard() {
    if (!document.querySelector('.dashboard-page')) {
        return;
    }

    const user = getCurrentUser();

    if (!user) {
        window.location.href = '/';
        return;
    }

    const userName = document.querySelector('.user-name');
    const userAvatar = document.querySelector('.user-avatar');

    if (userName) {
        userName.textContent = `${user.username} (${user.role})`;
    }

    if (userAvatar) {
        userAvatar.textContent = user.username.slice(0, 2).toUpperCase();
    }

    document.getElementById('userMenuBtn')?.addEventListener('click', () => {
        document.getElementById('userDropdown')?.classList.toggle('active');
    });

    document.getElementById('logoutBtn')?.addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    document.querySelectorAll('.nav-item[data-page], .card-clickable[data-action]').forEach((item) => {
        item.addEventListener('click', () => showPage(item.dataset.page || item.dataset.action));
    });

    document.getElementById('reportAreaSelect')?.addEventListener('change', loadFollowUpReports);

    initEquipmentDatabase(user);
    loadFollowUpReports();
}

function showPage(page) {
    document.querySelectorAll('.page').forEach((section) => {
        section.classList.remove('active');
    });

    document.getElementById(`${page}-page`)?.classList.add('active');

    document.querySelectorAll('.nav-item').forEach((navItem) => {
        navItem.classList.toggle('active', navItem.dataset.page === page);
    });
}

async function loadEquipment() {
    return API.get('/api/equipment?includeInactive=1');
}

function renderEquipment(equipment) {
    const tableBody = document.getElementById('equipmentTableBody');
    const select = document.getElementById('readingEquipment');
    const areaFilter = document.getElementById('equipmentAreaFilter');
    const selectedArea = areaFilter?.value || '';
    const visibleEquipment = selectedArea
        ? equipment.filter((item) => item.area === selectedArea)
        : equipment;

    if (tableBody) {
        tableBody.innerHTML = visibleEquipment.length
            ? visibleEquipment.map((item) => `
                <tr>
                    <td>${escapeHtml(item.equipment_key)}</td>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.area || '-')}</td>
                    <td>${item.critical ? 'Crítico' : 'General'}</td>
                    <td>${item.active ? 'Activo' : 'Inactivo'}</td>
                    <td>
                        <button class="btn-table-action" type="button" data-edit-equipment="${item.id}">
                            Editar
                        </button>
                    </td>
                </tr>
            `).join('')
            : '<tr><td class="empty-row" colspan="6">Sin equipos registrados</td></tr>';
    }

    if (select) {
        const activeEquipment = equipment.filter((item) => item.active);
        select.innerHTML = activeEquipment.length
            ? activeEquipment.map((item) => `
                <option value="${item.id}">${escapeHtml(item.equipment_key)} - ${escapeHtml(item.name)}</option>
            `).join('')
            : '<option value="">Sin equipos disponibles</option>';
    }

    if (areaFilter) {
        const areas = [...new Set(equipment.map((item) => item.area).filter(Boolean))].sort();
        areaFilter.innerHTML = `
            <option value="">Todas las áreas</option>
            ${areas.map((area) => `
                <option value="${escapeHtml(area)}"${area === selectedArea ? ' selected' : ''}>${escapeHtml(area)}</option>
            `).join('')}
        `;
    }

    document.querySelectorAll('[data-edit-equipment]').forEach((button) => {
        button.addEventListener('click', () => {
            const equipmentId = Number(button.dataset.editEquipment);
            const item = equipment.find((candidate) => candidate.id === equipmentId);

            if (item) {
                setEquipmentFormMode(item);
            }
        });
    });
}

async function loadDailyReadings() {
    const tableBody = document.getElementById('dailyReadingsTableBody');

    if (!tableBody) {
        return;
    }

    try {
        const readings = await API.get('/api/daily-readings');

        tableBody.innerHTML = readings.length
            ? readings.map((item) => {
                const findings = [
                    item.vibration ? 'Vibración' : '',
                    item.noise ? 'Ruido' : '',
                    item.cleaning_required ? 'Limpieza' : ''
                ].filter(Boolean).join(', ') || '-';

                return `
                    <tr>
                        <td>${escapeHtml(new Date(item.date).toLocaleString())}</td>
                        <td>${escapeHtml(item.equipment_key)}</td>
                        <td>${escapeHtml(item.equipment_name)}</td>
                        <td>${escapeHtml(item.temperature)} °C</td>
                        <td>${escapeHtml(item.current)} A</td>
                        <td>${escapeHtml(findings)}</td>
                        <td>${escapeHtml(item.comments || '-')}</td>
                    </tr>
                `;
            }).join('')
            : '<tr><td class="empty-row" colspan="7">Sin registros diarios</td></tr>';
    } catch (error) {
        tableBody.innerHTML = '<tr><td class="empty-row" colspan="7">No tienes permiso para ver registros</td></tr>';
    }
}

function formatRelativeDate(dateValue) {
    const date = new Date(dateValue);
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    if (diffDays <= 0) {
        return 'Hoy';
    }

    if (diffDays === 1) {
        return 'Ayer';
    }

    return `Hace ${diffDays} días`;
}

function getReportFindings(item) {
    return [
        item.vibration ? { label: 'Vibración', className: 'report-flag-vibration' } : null,
        item.noise ? { label: 'Ruido', className: 'report-flag-noise' } : null,
        item.cleaning_required ? { label: 'Limpieza', className: 'report-flag-dirt' } : null,
        (item.comments || '').trim() ? { label: 'Comentario', className: 'report-flag-comment' } : null
    ].filter(Boolean);
}

function renderFollowUpReports(reports) {
    const reportList = document.getElementById('followUpReportList');

    if (!reportList) {
        return;
    }

    if (!reports.length) {
        reportList.innerHTML = `
            <article class="report-card">
                <p class="report-desc">No hay equipos con hallazgos pendientes de seguimiento.</p>
            </article>
        `;
        return;
    }

    reportList.innerHTML = reports.map((item) => {
        const comments = (item.comments || '').trim();

        return `
            <article class="report-card">
                <div class="report-card-top">
                    <div>
                        <span class="report-title">${escapeHtml(item.equipment_key)} - ${escapeHtml(item.equipment_name)}</span>
                        <span class="report-area-label">Área: ${escapeHtml(item.area || '-')}</span>
                    </div>
                    <span class="report-days">${escapeHtml(formatRelativeDate(item.date))}</span>
                </div>
                <p class="report-desc">
                    Temperatura: ${escapeHtml(item.temperature)} °C · Corriente: ${escapeHtml(item.current)} A
                    ${comments ? `<br>Comentarios: ${escapeHtml(comments)}` : ''}
                </p>
                <div class="report-flags">
                    ${getReportFindings(item).map((finding) => `
                        <span class="report-flag ${finding.className}">${escapeHtml(finding.label)}</span>
                    `).join('')}
                </div>
            </article>
        `;
    }).join('');
}

async function loadFollowUpReports() {
    const reportList = document.getElementById('followUpReportList');

    if (!reportList) {
        return;
    }

    try {
        const area = document.getElementById('reportAreaSelect')?.value || '';
        const query = area ? `?area=${encodeURIComponent(area)}` : '';
        renderFollowUpReports(await API.get(`/api/follow-up-reports${query}`));
    } catch (error) {
        reportList.innerHTML = `
            <article class="report-card">
                <p class="report-desc">No se pudieron cargar los reportes de seguimiento.</p>
            </article>
        `;
    }
}

async function refreshEquipmentDatabase() {
    const equipment = await loadEquipment();
    renderEquipment(equipment);
    await loadDailyReadings();
    await loadFollowUpReports();
}

function initEquipmentDatabase(user) {
    const equipmentForm = document.getElementById('equipmentForm');
    const dailyReadingForm = document.getElementById('dailyReadingForm');

    if (equipmentForm && !user.permissions?.includes('motors:create')) {
        equipmentForm.style.display = 'none';
    }

    document.getElementById('equipmentAreaFilter')?.addEventListener('change', async () => {
        renderEquipment(await loadEquipment());
    });

    document.getElementById('equipmentCancelBtn')?.addEventListener('click', resetEquipmentForm);

    refreshEquipmentDatabase().catch((error) => {
        showAlert(error.message || 'Error al cargar equipos', 'error');
    });

    equipmentForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const equipmentId = document.getElementById('equipmentId').value;
        const payload = {
            equipment_key: document.getElementById('equipmentKey').value,
            name: document.getElementById('equipmentName').value,
            area: document.getElementById('equipmentArea').value,
            critical: document.getElementById('equipmentCritical').checked,
            active: document.getElementById('equipmentActive').checked
        };

        try {
            if (equipmentId) {
                await API.put(`/api/equipment/${equipmentId}`, payload);
            } else {
                await API.post('/api/equipment', payload);
            }

            resetEquipmentForm();
            await refreshEquipmentDatabase();
            showPage('equipment');
            showAlert(equipmentId ? 'Equipo actualizado' : 'Equipo guardado', 'success');
        } catch (error) {
            showAlert(error.message || 'Error al guardar equipo', 'error');
        }
    });

    dailyReadingForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
            await API.post('/api/daily-readings', {
                motor_id: document.getElementById('readingEquipment').value,
                temperature: Number(document.getElementById('readingTemperature').value),
                current: Number(document.getElementById('readingCurrent').value),
                vibration: document.getElementById('readingVibration').checked,
                noise: document.getElementById('readingNoise').checked,
                cleaning_required: document.getElementById('readingCleaning').checked,
                comments: document.getElementById('readingComments').value
            });

            dailyReadingForm.reset();
            await loadDailyReadings();
            await loadFollowUpReports();
            showPage('general');
            showAlert('Recorrido guardado', 'success');
        } catch (error) {
            showAlert(error.message || 'Error al guardar recorrido', 'error');
        }
    });
}

function setEquipmentFormMode(item) {
    document.getElementById('equipmentId').value = item.id;
    document.getElementById('equipmentKey').value = item.equipment_key || '';
    document.getElementById('equipmentName').value = item.name || '';
    document.getElementById('equipmentArea').value = item.area || '';
    document.getElementById('equipmentCritical').checked = Boolean(item.critical);
    document.getElementById('equipmentActive').checked = Boolean(item.active);
    document.getElementById('equipmentSubmitBtn').textContent = 'Actualizar equipo';
    document.getElementById('equipmentCancelBtn').style.display = 'inline-block';
    showPage('equipment');
}

function resetEquipmentForm() {
    const equipmentForm = document.getElementById('equipmentForm');

    if (!equipmentForm) {
        return;
    }

    equipmentForm.reset();
    document.getElementById('equipmentId').value = '';
    document.getElementById('equipmentActive').checked = true;
    document.getElementById('equipmentSubmitBtn').textContent = 'Guardar equipo';
    document.getElementById('equipmentCancelBtn').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initDashboard();
});
