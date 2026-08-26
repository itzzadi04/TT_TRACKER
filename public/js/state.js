/**
 * TT_TRACKER — State Store
 * Manages global timetable studio state, selected entities, active week, and drag operations.
 */

export const Store = {
    // Academic Calendar & Context
    workflowContext: null,
    devMode: false,
    simulatedDay: null,

    // Studio View Configuration
    currentView: 'faculty', // 'faculty' | 'section' | 'room'
    currentMode: 'current', // 'current' | 'next' | 'base'
    selectedEntityId: null,

    // Cached Entity Dictionaries
    entities: {
        faculties: [],
        sections: [],
        rooms: []
    },

    // Current Timetable Grid Response
    gridData: null,

    // Drag-and-Drop & Reschedule State
    rescheduleMode: false,
    rescheduleActionType: 'reschedule', // 'reschedule' | 'schedule_next'
    unlockedSlot: null,
    pendingPlacement: null,
    lastConflictDetails: null,

    // Helpers
    getActiveWeekKey() {
        if (this.currentMode === 'current') return this.workflowContext?.currentWeekKey;
        if (this.currentMode === 'next') return this.workflowContext?.nextWeekKey;
        return null;
    },

    isCurrentWeekEditable() {
        return !!this.workflowContext?.currentWeekEditable;
    },

    isNextWeekEditable() {
        return !!this.workflowContext?.nextWeekEditable;
    },

    isWorkingWeekEditable() {
        if (this.currentMode === 'current') return this.isCurrentWeekEditable();
        if (this.currentMode === 'next') return this.isNextWeekEditable();
        if (this.currentMode === 'base') return true;
        return false;
    }
};
