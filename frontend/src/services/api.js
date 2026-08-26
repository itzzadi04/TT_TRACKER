/**
 * TT_TRACKER — Frontend API Service Client
 * Interfaces React components with the Express backend endpoints.
 */

export const ApiService = {
  async getWorkflowContext(simulatedDay = null) {
    let url = '/api/timetable/workflow-context';
    if (simulatedDay) {
      url += `?simulatedDay=${encodeURIComponent(simulatedDay)}`;
    }
    const res = await fetch(url);
    return res.json();
  },

  async getEntities() {
    const res = await fetch('/api/timetable/entities');
    return res.json();
  },

  async getGrid(params = {}) {
    const query = new URLSearchParams();
    const type = (params.viewType || 'FACULTY').toUpperCase();
    query.set('type', type);
    query.set('id', params.entityId || '');
    query.set('week', params.mode || 'current');

    const res = await fetch(`/api/timetable/grid?${query.toString()}`);
    return res.json();
  },

  async validateDrop(payload) {
    const res = await fetch('/api/timetable/validate-drop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async moveOrAddSlot(payload) {
    const res = await fetch('/api/timetable/move-or-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async cancelSlot(payload) {
    const res = await fetch('/api/timetable/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async getAvailableRooms(day, start, end, week = 'current') {
    const query = new URLSearchParams({
      day,
      start,
      end,
      week,
    });
    const res = await fetch(`/api/timetable/rooms/available?${query.toString()}`);
    return res.json();
  },
};
