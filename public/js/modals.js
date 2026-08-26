/**
 * TT_TRACKER — Modals & Dialog Controllers
 * Handles Action Menus, Cancel Confirmation, Room Conflict Reassignment, and Notifications.
 */

import { Store } from './state.js';
import { ApiService } from './api.js';

export const ModalController = {
    // Show Toast Notification
    showToast(message, isError = false) {
        const toast = document.getElementById('toastAlert');
        if (!toast) return;
        toast.className = `toast-box ${isError ? 'toast-error' : 'toast-success'}`;
        toast.textContent = message;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 4500);
    },

    // 1. CLASS ACTION SELECTION MODAL
    openClassActionModal(slot, onActionSelected) {
        Store.selectedSlot = slot;
        const overlay = document.getElementById('actionModalOverlay');
        const title = document.getElementById('actionModalTitle');
        const details = document.getElementById('actionModalDetails');
        const btnReschedule = document.getElementById('btnActionReschedule');
        const btnCancel = document.getElementById('btnActionCancel');
        const btnScheduleNext = document.getElementById('btnActionScheduleNext');

        if (!overlay) return;

        title.textContent = `${slot.subjectCode} — ${slot.subjectName || 'Class'}`;
        details.innerHTML = `
            <strong>Day & Time:</strong> ${slot.day} ${slot.starting || ''} - ${slot.ending || ''}<br>
            <strong>Room:</strong> ${slot.roomNo || 'TBD'}<br>
            <strong>Section:</strong> ${slot.sectionId || 'N/A'} ${slot.group ? `(Group ${slot.group})` : ''}<br>
            <strong>Faculty:</strong> ${slot.facultyName || slot.facultyId || 'Unassigned'}<br>
            <strong>Active Timetable:</strong> ${Store.currentMode.toUpperCase()} TIMETABLE
        `;

        // Configure Action Button Visibilities based on Active Week Rules
        const isEditable = Store.isWorkingWeekEditable();
        
        btnReschedule.style.display = isEditable ? 'flex' : 'none';
        btnCancel.style.display = isEditable ? 'flex' : 'none';

        // SCHEDULE FOR NEXT WEEK: Allowed during Mon-Fri from Current Week
        if (Store.currentMode === 'current' && !Store.isNextWeekEditable()) {
            btnScheduleNext.style.display = 'flex';
        } else {
            btnScheduleNext.style.display = 'none';
        }

        // Action Handlers
        btnReschedule.onclick = () => {
            overlay.style.display = 'none';
            onActionSelected('RESCHEDULE', slot);
        };

        btnCancel.onclick = () => {
            overlay.style.display = 'none';
            onActionSelected('CANCEL', slot);
        };

        btnScheduleNext.onclick = () => {
            overlay.style.display = 'none';
            onActionSelected('ADD_EXTRA', slot);
        };

        overlay.style.display = 'flex';
    },

    closeClassActionModal() {
        const overlay = document.getElementById('actionModalOverlay');
        if (overlay) overlay.style.display = 'none';
    },

    // 2. EXPLICIT CANCEL CONFIRMATION MODAL
    openCancelConfirmModal(slot, onConfirmed) {
        const overlay = document.getElementById('confirmCancelModalOverlay');
        const details = document.getElementById('cancelModalDetails');
        const btnKeep = document.getElementById('btnCancelKeep');
        const btnConfirm = document.getElementById('btnCancelConfirm');

        if (!overlay) return;

        details.innerHTML = `
            <div class="details-box">
                <strong>${slot.subjectCode}</strong> — ${slot.subjectName || ''}<br>
                <span>${slot.sectionId || ''} ${slot.group ? `(Group ${slot.group})` : ''}</span><br>
                <span><strong>Time:</strong> ${slot.day} ${slot.starting} - ${slot.ending}</span><br>
                <span><strong>Room:</strong> ${slot.roomNo || 'TBD'}</span>
            </div>
            <p style="margin-top: 6px; font-size: 12px; color: #64748b;">
                This will cancel the class from the <strong>${Store.currentMode.toUpperCase()}</strong> timetable context.
            </p>
        `;

        btnKeep.onclick = () => {
            overlay.style.display = 'none';
        };

        btnConfirm.onclick = () => {
            overlay.style.display = 'none';
            onConfirmed(slot);
        };

        overlay.style.display = 'flex';
    },

    // 3. ROOM CONFLICT REASSIGNMENT MODAL
    async openRoomConflictModal(conflictData, onReassignRoom) {
        const overlay = document.getElementById('roomConflictModalOverlay');
        const msg = document.getElementById('roomConflictMessage');
        const roomSelect = document.getElementById('availableRoomsDropdown');
        const btnReassign = document.getElementById('btnReassignRoomConfirm');
        const btnCancel = document.getElementById('btnRoomConflictCancel');

        if (!overlay) return;

        msg.textContent = (conflictData.errors && conflictData.errors[0]) || 'Room is occupied in this time slot.';
        roomSelect.innerHTML = '<option value="">-- Loading Vacant Rooms --</option>';
        btnReassign.disabled = true;

        overlay.style.display = 'flex';

        try {
            const roomsRes = await ApiService.getAvailableRooms(
                Store.pendingPlacement.targetSlot.day,
                Store.pendingPlacement.targetSlot.starting,
                Store.pendingPlacement.targetSlot.ending,
                Store.currentMode
            );

            if (roomsRes.success && roomsRes.rooms && roomsRes.rooms.length > 0) {
                roomSelect.innerHTML = '<option value="">-- Select Vacant Room --</option>' +
                    roomsRes.rooms.map(r => `<option value="${r.roomNo}">${r.roomNo} (${r.building || 'Building'} · Cap: ${r.capacity || 'Std'})</option>`).join('');
                
                roomSelect.onchange = () => {
                    btnReassign.disabled = !roomSelect.value;
                };

                btnReassign.onclick = () => {
                    overlay.style.display = 'none';
                    onReassignRoom(roomSelect.value);
                };
            } else {
                roomSelect.innerHTML = '<option value="">No vacant rooms available in this slot</option>';
            }
        } catch (e) {
            roomSelect.innerHTML = '<option value="">Error fetching vacant rooms</option>';
        }

        btnCancel.onclick = () => {
            overlay.style.display = 'none';
        };
    },

    // 4. DROP CONFIRMATION MODAL
    openDropConfirmModal(pending, onConfirm) {
        const overlay = document.getElementById('dropConfirmModalOverlay');
        const details = document.getElementById('dropConfirmDetails');
        const scopeText = document.getElementById('dropScopePrompt');
        const btnConfirm = document.getElementById('btnDropConfirm');
        const btnCancel = document.getElementById('btnDropCancel');

        if (!overlay) return;

        const isNextWeekMode = Store.rescheduleActionType === 'ADD_EXTRA';
        const targetWeekLabel = isNextWeekMode ? 'NEXT WEEK' : `${Store.currentMode.toUpperCase()} WEEK`;

        details.innerHTML = `
            <div class="details-box">
                <strong>Subject:</strong> ${pending.targetSlot.subjectCode}<br>
                <strong>New Slot:</strong> ${pending.targetSlot.day} ${pending.targetSlot.starting} - ${pending.targetSlot.ending}<br>
                <strong>Room:</strong> ${pending.targetSlot.roomNo || 'TBD'}<br>
                <strong>Target Timetable:</strong> ${targetWeekLabel}
            </div>
        `;

        if (Store.currentMode === 'base') {
            scopeText.textContent = 'This change will modify the Base Blueprint and apply permanently to all future weeks.';
        } else {
            scopeText.textContent = `This modification applies strictly to ${targetWeekLabel}.`;
        }

        btnConfirm.onclick = () => {
            overlay.style.display = 'none';
            onConfirm(pending);
        };

        btnCancel.onclick = () => {
            overlay.style.display = 'none';
        };

        overlay.style.display = 'flex';
    }
};
