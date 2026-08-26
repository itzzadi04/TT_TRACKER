/**
 * TT_TRACKER — Main Application Controller
 * Orchestrates views, entities, modes, drag-and-drop reschedule flows, cancellations, and polling.
 */

import { Store } from './state.js';
import { ApiService } from './api.js';
import { ModalController } from './modals.js';
import { TimetableRenderer } from './timetable.js';

export const App = {
    async init() {
        console.log('[App] Initializing NIT Hamirpur Academic Timetable Studio...');
        this.bindStaticUIEvents();
        await this.loadWorkflowContext();
        await this.loadEntities();
        await this.loadTimetable();

        // 60-second periodic workflow context poll for seamless calendar rollovers
        setInterval(() => this.pollWorkflowContext(), 60000);
    },

    bindStaticUIEvents() {
        // 1. View Switcher Tabs (Faculty / Section / Room)
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                const view = btn.dataset.view;
                if (view === Store.currentView) return;

                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                Store.currentView = view;
                this.updateEntityDropdown();
                this.loadTimetable();
            };
        });

        // 2. Schedule Mode Toggles (Current Week / Next Week / Base Timetable)
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.onclick = () => {
                const mode = btn.dataset.mode;
                if (mode === Store.currentMode) return;

                document.querySelectorAll('.mode-btn').forEach(b => {
                    b.classList.remove('active');
                    b.classList.remove('active-base');
                });

                if (mode === 'base') {
                    btn.classList.add('active-base');
                } else {
                    btn.classList.add('active');
                }

                Store.currentMode = mode;
                this.exitRescheduleMode();
                this.updateStatusBadge();
                this.loadTimetable();
            };
        });

        // 3. Entity Select Dropdown Change
        const entitySelect = document.getElementById('entitySelect');
        if (entitySelect) {
            entitySelect.onchange = () => {
                Store.selectedEntityId = entitySelect.value;
                this.loadTimetable();
            };
        }

        // 4. Simulated Day Selector (Dev Mode)
        const simSelect = document.getElementById('simulatedDaySelect');
        if (simSelect) {
            simSelect.onchange = async () => {
                Store.simulatedDay = simSelect.value || null;
                await this.loadWorkflowContext();
                this.loadTimetable();
            };
        }

        // 5. Cancel Reschedule Drag Mode Banner Button
        const btnCancelDrag = document.getElementById('btnCancelDragMode');
        if (btnCancelDrag) {
            btnCancelDrag.onclick = () => this.exitRescheduleMode();
        }

        // Close action modal on backdrop click
        const actionOverlay = document.getElementById('actionModalOverlay');
        if (actionOverlay) {
            actionOverlay.onclick = (e) => {
                if (e.target === actionOverlay) ModalController.closeClassActionModal();
            };
        }
    },

    async loadWorkflowContext() {
        try {
            const res = await ApiService.getWorkflowContext(Store.simulatedDay);
            if (res.success) {
                Store.workflowContext = res;
                Store.devMode = !!res.devMode;

                // Update Real Date & Week Displays
                const realDateElem = document.getElementById('realDateDisplay');
                if (realDateElem) {
                    realDateElem.textContent = res.todayFormatted || res.today;
                }

                // Update Button Week Date Labels
                const btnCurrent = document.getElementById('btnModeCurrent');
                const btnNext = document.getElementById('btnModeNext');

                if (btnCurrent && res.currentWeekFormatted) {
                    btnCurrent.textContent = `Current Week (${res.currentWeekFormatted})`;
                }
                if (btnNext && res.nextWeekFormatted) {
                    btnNext.textContent = `Next Week (${res.nextWeekFormatted})`;
                }

                // Show/Hide Dev Mode Simulation Selector
                const devContainer = document.getElementById('devSimulatedDayGroup');
                if (devContainer) {
                    devContainer.style.display = Store.devMode ? 'flex' : 'none';
                }

                this.updateStatusBadge();
            }
        } catch (err) {
            console.error('[App] Failed to load workflow context', err);
        }
    },

    async pollWorkflowContext() {
        if (!Store.devMode) {
            await this.loadWorkflowContext();
        }
    },

    updateStatusBadge() {
        const badge = document.getElementById('weekStatusBadge');
        if (!badge || !Store.workflowContext) return;

        if (Store.currentMode === 'base') {
            badge.className = 'badge-status badge-base';
            badge.textContent = 'BASE BLUEPRINT';
        } else if (Store.currentMode === 'current') {
            const isEditable = Store.workflowContext.currentWeekEditable;
            badge.className = `badge-status ${isEditable ? 'badge-editable' : 'badge-readonly'}`;
            badge.textContent = isEditable ? 'CURRENT WEEK: EDITABLE' : 'CURRENT WEEK: READ-ONLY';
        } else if (Store.currentMode === 'next') {
            const isEditable = Store.workflowContext.nextWeekEditable;
            badge.className = `badge-status ${isEditable ? 'badge-editable' : 'badge-readonly'}`;
            badge.textContent = isEditable ? 'NEXT WEEK: EDITABLE' : 'NEXT WEEK: LOCKED';
        }
    },

    async loadEntities() {
        try {
            const res = await ApiService.getEntities();
            Store.entities.faculties = res.faculties || [];
            Store.entities.sections = res.sections || [];
            Store.entities.rooms = res.rooms || [];
            this.updateEntityDropdown();
        } catch (err) {
            console.error('[App] Failed to load entities', err);
        }
    },

    updateEntityDropdown() {
        const select = document.getElementById('entitySelect');
        const label = document.getElementById('entitySelectLabel');
        if (!select || !label) return;

        let list = [];
        if (Store.currentView === 'faculty') {
            label.textContent = 'Select Faculty:';
            list = Store.entities.faculties.map(f => typeof f === 'string' ? { id: f, name: f } : { id: f.name || f.facultyId, name: f.name || f.facultyId });
        } else if (Store.currentView === 'section') {
            label.textContent = 'Select Section:';
            list = Store.entities.sections.map(s => typeof s === 'string' ? { id: s, name: s } : { id: s.name || s.sectionId, name: s.name || s.sectionId });
        } else if (Store.currentView === 'room') {
            label.textContent = 'Select Room:';
            list = Store.entities.rooms.map(r => typeof r === 'string' ? { id: r, name: r } : { id: r.roomNo || r.name, name: `${r.roomNo || r.name} (${r.type || 'Lecture'})` });
        }

        select.innerHTML = list.map(item => `<option value="${item.id}">${item.name}</option>`).join('');

        if (list.length > 0) {
            Store.selectedEntityId = list[0].id;
            select.value = Store.selectedEntityId;
        } else {
            Store.selectedEntityId = null;
        }
    },

    async loadTimetable() {
        const gridContainer = document.getElementById('timetableGridContainer');
        if (!gridContainer) return;

        if (!Store.selectedEntityId) {
            gridContainer.innerHTML = '<div style="padding: 32px; text-align: center; color: #64748b;">Please select an entity from the dropdown above.</div>';
            return;
        }

        try {
            const res = await ApiService.getGrid({
                mode: Store.currentMode,
                viewType: Store.currentView,
                entityId: Store.selectedEntityId
            });

            if (res.success && res.grid) {
                Store.gridData = res;
                TimetableRenderer.renderGrid(
                    gridContainer,
                    res,
                    (slot) => this.handleClassClick(slot),
                    (pending) => this.handleSlotDrop(pending)
                );
            } else {
                ModalController.showToast(res.error || 'Unable to load timetable.', true);
            }
        } catch (err) {
            console.error('[App] Error fetching timetable grid', err);
            ModalController.showToast('Network error while loading timetable.', true);
        }
    },

    // Handle Clicking a Class Card
    handleClassClick(slot) {
        ModalController.openClassActionModal(slot, (actionType, selectedSlot) => {
            if (actionType === 'CANCEL') {
                ModalController.openCancelConfirmModal(selectedSlot, (confirmedSlot) => {
                    this.executeCancel(confirmedSlot);
                });
            } else if (actionType === 'RESCHEDULE' || actionType === 'ADD_EXTRA') {
                this.enterRescheduleMode(selectedSlot, actionType);
            }
        });
    },

    enterRescheduleMode(slot, actionType) {
        Store.rescheduleMode = true;
        Store.rescheduleActionType = actionType;
        Store.unlockedSlot = slot;

        const banner = document.getElementById('dragModeBanner');
        const bannerText = document.getElementById('dragModeText');

        if (banner && bannerText) {
            if (actionType === 'ADD_EXTRA') {
                bannerText.textContent = `Schedule for Next Week: Drag ${slot.subjectCode} or click any target time slot.`;
            } else {
                bannerText.textContent = `Rescheduling ${slot.subjectCode}: Drag or click target time slot.`;
            }
            banner.style.display = 'flex';
        }

        // Re-render grid to reflect active target drop slots and draggable card
        this.loadTimetable();
    },

    exitRescheduleMode() {
        Store.rescheduleMode = false;
        Store.unlockedSlot = null;
        Store.pendingPlacement = null;

        const banner = document.getElementById('dragModeBanner');
        if (banner) banner.style.display = 'none';

        this.loadTimetable();
    },

    // Handle Dropping or Selecting a Target Slot
    async handleSlotDrop(pendingDrop) {
        const slot = pendingDrop.slot;
        const targetSlot = {
            ...slot,
            day: pendingDrop.day,
            starting: pendingDrop.starting,
            ending: pendingDrop.ending,
            roomNo: pendingDrop.roomNo || slot.roomNo
        };

        const targetWeek = Store.rescheduleActionType === 'ADD_EXTRA' ? 'next' : Store.currentMode;
        const targetScope = Store.currentMode === 'base' ? 'PERMANENT' : (Store.rescheduleActionType === 'ADD_EXTRA' ? 'NEXT_WEEK' : 'CURRENT_WEEK');

        Store.pendingPlacement = {
            originalSlot: slot,
            targetSlot,
            week: targetWeek,
            scope: targetScope
        };

        const validatePayload = {
            actionType: Store.rescheduleActionType,
            originalSlot: slot,
            targetSlot,
            week: targetWeek,
            scope: targetScope
        };

        try {
            ModalController.showToast('Checking schedule conflicts...', false);
            const valRes = await ApiService.validateDrop(validatePayload);

            if (valRes.isAvailable) {
                // Free slot -> Show Confirmation
                ModalController.openDropConfirmModal(Store.pendingPlacement, (confirmed) => {
                    this.commitMoveOrAdd(confirmed);
                });
            } else if (valRes.isRoomOnlyConflict) {
                // Pure room conflict -> Offer available rooms
                ModalController.openRoomConflictModal(valRes, (newRoomNo) => {
                    pendingDrop.roomNo = newRoomNo;
                    this.handleSlotDrop(pendingDrop); // Revalidate with new room
                });
            } else {
                // Lab or Section conflict -> Show rejection
                const errMsg = (valRes.errors && valRes.errors[0]) || 'Schedule conflict detected. Drop rejected.';
                ModalController.showToast(errMsg, true);
            }
        } catch (err) {
            console.error('[App] Validation failed', err);
            ModalController.showToast('Failed to validate schedule drop.', true);
        }
    },

    async commitMoveOrAdd(confirmedPlacement) {
        const payload = {
            actionType: Store.rescheduleActionType,
            originalSlot: confirmedPlacement.originalSlot,
            targetSlot: confirmedPlacement.targetSlot,
            week: confirmedPlacement.week,
            scope: confirmedPlacement.scope
        };

        try {
            const res = await ApiService.moveOrAddSlot(payload);
            if (res.success) {
                ModalController.showToast(res.message || 'Timetable updated successfully.');
                this.exitRescheduleMode();
            } else {
                ModalController.showToast(res.error || 'Unable to update timetable.', true);
            }
        } catch (err) {
            console.error('[App] Move mutation failed', err);
            ModalController.showToast('Error committing timetable update.', true);
        }
    },

    async executeCancel(slot) {
        const payload = {
            slot,
            week: Store.currentMode,
            scope: Store.currentMode === 'base' ? 'PERMANENT' : (Store.currentMode === 'next' ? 'NEXT_WEEK' : 'CURRENT_WEEK')
        };

        try {
            const res = await ApiService.cancelSlot(payload);
            if (res.success) {
                ModalController.showToast(res.message || 'Class cancelled successfully.');
                this.loadTimetable();
            } else {
                ModalController.showToast(res.error || 'Unable to cancel class.', true);
            }
        } catch (err) {
            console.error('[App] Cancel mutation failed', err);
            ModalController.showToast('Error cancelling class.', true);
        }
    }
};

// Start application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
