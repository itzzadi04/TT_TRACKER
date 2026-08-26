/**
 * TT_TRACKER — Timetable Grid & Cell Renderer
 * Transforms backend grid matrix into Stitch Institutional Academic UI.
 */

import { Store } from './state.js';

export const TimetableRenderer = {
    renderGrid(gridContainer, gridResponse, onClassClick, onSlotDrop) {
        if (!gridContainer) return;
        const gridDays = gridResponse?.grid;

        if (!gridDays || !Array.isArray(gridDays) || gridDays.length === 0) {
            gridContainer.innerHTML = '<div style="padding: 32px; text-align: center; color: #64748b;">No timetable data found for this selection.</div>';
            return;
        }

        // Derive Time Headers from first day's slots
        const firstDay = gridDays[0];
        const timeHeaders = firstDay.slots ? firstDay.slots.map(s => `${s.start} - ${s.end}`) : [];

        let tableHtml = `
            <table class="timetable-grid">
                <thead>
                    <tr>
                        <th class="day-header-col">DAY / TIME</th>
                        ${timeHeaders.map(t => `<th>${t}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        gridDays.forEach(dayRow => {
            tableHtml += `
                <tr>
                    <td class="day-header-col">${dayRow.day.toUpperCase()}</td>
            `;

            (dayRow.slots || []).forEach(slotItem => {
                const isOccupied = !!slotItem.occupied;
                const slotClasses = ['cell-slot'];

                if (Store.rescheduleMode) {
                    slotClasses.push('target-active');
                }

                tableHtml += `
                    <td class="${slotClasses.join(' ')}" 
                        data-day="${dayRow.day}" 
                        data-start="${slotItem.start}" 
                        data-end="${slotItem.end}">
                        <div class="cell-content-stack">
                `;

                if (isOccupied) {
                    // Normalize single or multiple simultaneous slots (e.g. G1 + G2)
                    let classList = [];
                    if (slotItem.multipleSlots && Array.isArray(slotItem.multipleSlots) && slotItem.multipleSlots.length > 0) {
                        classList = slotItem.multipleSlots;
                    } else if (slotItem.data) {
                        classList = [slotItem.data];
                    }

                    classList.forEach(c => {
                        const isLab = !!c.isLab || (c.group && ['G1', 'G2'].includes(c.group));
                        const isUnlocked = Store.unlockedSlot && (Store.unlockedSlot.slotId === c.slotId || Store.unlockedSlot.sessionId === c.sessionId);
                        const isExtra = c.overrideAction === 'ADD_EXTRA' || c.isExtra;
                        const isOverride = c.isOverride || c.overrideAction === 'RESCHEDULE';

                        let cardClasses = ['card-class'];
                        if (isLab) cardClasses.push('is-lab');
                        if (isExtra) cardClasses.push('is-extra');
                        if (isOverride) cardClasses.push('is-override');
                        if (isUnlocked) cardClasses.push('unlocked-drag');

                        tableHtml += `
                            <div class="${cardClasses.join(' ')}"
                                 data-id="${c.slotId || c.originalSlotId || ''}"
                                 data-raw='${encodeURIComponent(JSON.stringify(c))}'
                                 ${isUnlocked ? 'draggable="true"' : ''}>
                                
                                <div class="card-tags">
                                    ${isLab ? `<span class="tag-badge tag-lab">LAB</span>` : ''}
                                    ${c.group ? `<span class="tag-badge tag-group">${c.group}</span>` : ''}
                                    ${isExtra ? `<span class="tag-badge tag-extra">SCHEDULED</span>` : ''}
                                    ${isOverride ? `<span class="tag-badge tag-override">RESCHEDULED</span>` : ''}
                                </div>

                                <div class="card-code">${c.subjectCode || 'CLASS'}</div>

                                <div class="card-meta">
                                    ${Store.currentView !== 'faculty' && c.facultyName ? `<div>👤 ${c.facultyName}</div>` : (c.facultyId ? `<div>👤 ${c.facultyId}</div>` : '')}
                                    ${Store.currentView !== 'section' && c.sectionId ? `<div>👥 ${c.sectionId}</div>` : ''}
                                    ${Store.currentView !== 'room' && c.roomNo ? `<div>📍 ${c.roomNo}</div>` : ''}
                                </div>
                            </div>
                        `;
                    });
                }

                tableHtml += `
                        </div>
                    </td>
                `;
            });

            tableHtml += `</tr>`;
        });

        tableHtml += `
                </tbody>
            </table>
        `;

        gridContainer.innerHTML = tableHtml;
        this.attachEventListeners(gridContainer, onClassClick, onSlotDrop);
    },

    attachEventListeners(gridContainer, onClassClick, onSlotDrop) {
        // Card Click Listener
        gridContainer.querySelectorAll('.card-class').forEach(card => {
            card.onclick = (e) => {
                e.stopPropagation();
                if (Store.rescheduleMode && Store.unlockedSlot) return; // In active drop mode, ignore clicks on cards
                const rawJson = decodeURIComponent(card.dataset.raw);
                try {
                    const slotData = JSON.parse(rawJson);
                    onClassClick(slotData);
                } catch (err) {
                    console.error('Failed to parse slot card JSON', err);
                }
            };

            // Drag Start
            card.ondragstart = (e) => {
                const rawJson = decodeURIComponent(card.dataset.raw);
                e.dataTransfer.setData('text/plain', rawJson);
                card.style.opacity = '0.4';
            };

            card.ondragend = () => {
                card.style.opacity = '1';
            };
        });

        // Cell Drop Targets
        gridContainer.querySelectorAll('.cell-slot').forEach(cell => {
            cell.ondragover = (e) => {
                if (Store.rescheduleMode) {
                    e.preventDefault();
                    cell.classList.add('drag-over');
                }
            };

            cell.ondragleave = () => {
                cell.classList.remove('drag-over');
            };

            cell.ondrop = (e) => {
                if (!Store.rescheduleMode) return;
                e.preventDefault();
                cell.classList.remove('drag-over');

                const rawData = e.dataTransfer.getData('text/plain');
                if (!rawData) return;

                try {
                    const slot = JSON.parse(rawData);
                    const day = cell.dataset.day;
                    const starting = cell.dataset.start;
                    const ending = cell.dataset.end;
                    onSlotDrop({ slot, day, starting, ending, roomNo: slot.roomNo });
                } catch (err) {
                    console.error('Drop handling error', err);
                }
            };

            // Click on target slot when in Reschedule Mode
            cell.onclick = () => {
                if (Store.rescheduleMode && Store.unlockedSlot) {
                    const day = cell.dataset.day;
                    const starting = cell.dataset.start;
                    const ending = cell.dataset.end;
                    onSlotDrop({ slot: Store.unlockedSlot, day, starting, ending, roomNo: Store.unlockedSlot.roomNo });
                }
            };
        });
    }
};
