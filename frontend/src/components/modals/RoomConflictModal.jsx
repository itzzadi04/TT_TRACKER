import React, { useState } from 'react';

export default function RoomConflictModal({
  conflictData,
  availableRooms,
  onCancel,
  onReassign,
}) {
  const [selectedRoom, setSelectedRoom] = useState('');

  if (!conflictData) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ borderTop: '4px solid #f59e0b' }}>
        <div className="modal-header">
          <h3 style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined">meeting_room</span>
            Room Occupied — Choose Vacant Room
          </h3>
        </div>

        <div className="modal-body">
          <p style={{ marginBottom: '10px', color: '#b45309', fontWeight: 500 }}>
            {(conflictData.errors && conflictData.errors[0]) || 'Room is occupied in this time slot.'}
          </p>

          <label className="control-label" htmlFor="reassignRoomSelect" style={{ display: 'block', marginBottom: '6px' }}>
            Select an available vacant room:
          </label>
          <select
            id="reassignRoomSelect"
            className="form-control"
            style={{ width: '100%' }}
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
          >
            <option value="">-- Select Vacant Room --</option>
            {availableRooms.map((r) => (
              <option key={r.roomNo || r.name} value={r.roomNo || r.name}>
                {r.roomNo || r.name} ({r.building || 'Building'} · Cap: {r.capacity || 'Std'})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <button
            className="btn-modal btn-secondary"
            style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
            onClick={onCancel}
          >
            CANCEL MOVE
          </button>
          <button
            className="btn-modal btn-primary"
            style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
            disabled={!selectedRoom}
            onClick={() => onReassign(selectedRoom)}
          >
            REASSIGN ROOM & APPLY
          </button>
        </div>
      </div>
    </div>
  );
}
