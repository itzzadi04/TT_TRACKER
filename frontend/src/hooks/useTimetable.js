import { useState, useEffect, useCallback } from 'react';
import { ApiService } from '../services/api';

export function useTimetable() {
  // Calendar & Context
  const [workflowContext, setWorkflowContext] = useState(null);
  const [simulatedDay, setSimulatedDay] = useState(null);

  // Studio View Controls
  const [currentView, setCurrentView] = useState('faculty');
  const [currentMode, setCurrentMode] = useState('current');
  const [selectedEntityId, setSelectedEntityId] = useState(null);

  // Entities & Grid
  const [entities, setEntities] = useState({ faculties: [], sections: [], rooms: [] });
  const [gridData, setGridData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false); // true while a reschedule/cancel/add-extra is committing

  // Reschedule & Drag State
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleActionType, setRescheduleActionType] = useState('RESCHEDULE');
  const [unlockedSlot, setUnlockedSlot] = useState(null);
  const [selectedActionSlot, setSelectedActionSlot] = useState(null);
  const [cancelSlotTarget, setCancelSlotTarget] = useState(null);
  const [pendingPlacement, setPendingPlacement] = useState(null);
  const [roomConflictData, setRoomConflictData] = useState(null);
  const [availableRooms, setAvailableRooms] = useState([]);

  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  // 1. Fetch Workflow Context
  const loadWorkflowContext = useCallback(async () => {
    try {
      const res = await ApiService.getWorkflowContext(simulatedDay);
      if (res.success) {
        setWorkflowContext(res);
      }
    } catch (err) {
      console.error('[useTimetable] Context fetch failed', err);
    }
  }, [simulatedDay]);

  useEffect(() => {
    loadWorkflowContext();
    const interval = setInterval(loadWorkflowContext, 60000);
    return () => clearInterval(interval);
  }, [loadWorkflowContext]);

  // 2. Fetch Entities
  const loadEntities = useCallback(async () => {
    try {
      const res = await ApiService.getEntities();
      if (res) {
        setEntities({
          faculties: res.faculties || [],
          sections: res.sections || [],
          rooms: res.rooms || [],
        });
      }
    } catch (err) {
      console.error('[useTimetable] Entities fetch failed', err);
    }
  }, []);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  // 3. Update Default Selected Entity on View Change
  useEffect(() => {
    let list = [];
    if (currentView === 'faculty') list = entities.faculties;
    else if (currentView === 'section') list = entities.sections;
    else if (currentView === 'room') list = entities.rooms;

    if (list && list.length > 0) {
      const first = list[0];
      const id = typeof first === 'string' ? first : first.facultyId || first.sectionId || first.roomNo || first.name;
      setSelectedEntityId(id);
    } else {
      setSelectedEntityId(null);
    }
  }, [currentView, entities]);

  // 4. Fetch Grid
  const loadGrid = useCallback(async () => {
    if (!selectedEntityId) return;

    // Guard: ensure selectedEntityId belongs to currentView
    let validList = [];
    if (currentView === 'faculty') validList = entities.faculties;
    else if (currentView === 'section') validList = entities.sections;
    else if (currentView === 'room') validList = entities.rooms;

    if (validList && validList.length > 0 && !validList.includes(selectedEntityId)) {
      return; // Skip grid load while view and entityId are transitioning
    }

    setLoading(true);
    try {
      const res = await ApiService.getGrid({
        viewType: currentView,
        entityId: selectedEntityId,
        mode: currentMode,
      });

      if (res.success && res.grid) {
        setGridData(res);
      } else {
        showToast(res.error || 'Unable to load timetable.', true);
      }
    } catch (err) {
      console.error('[useTimetable] Grid fetch failed', err);
      showToast('Network error loading timetable grid.', true);
    } finally {
      setLoading(false);
    }
  }, [currentView, selectedEntityId, currentMode, entities, showToast]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  // Actions
  const handleClassClick = (slot) => {
    setSelectedActionSlot(slot);
  };

  const handleActionSelect = (actionType, slot) => {
    setSelectedActionSlot(null);
    if (actionType === 'CANCEL') {
      setCancelSlotTarget(slot);
    } else if (actionType === 'RESCHEDULE' || actionType === 'ADD_EXTRA') {
      setRescheduleMode(true);
      setRescheduleActionType(actionType);
      setUnlockedSlot(slot);
    }
  };

  const exitRescheduleMode = () => {
    setRescheduleMode(false);
    setUnlockedSlot(null);
    setPendingPlacement(null);
    setRoomConflictData(null);
  };

  const handleSlotDrop = async (dropInfo) => {
    const slot = dropInfo.slot;
    const targetSlot = {
      ...slot,
      day: dropInfo.day,
      starting: dropInfo.starting,
      ending: dropInfo.ending,
      roomNo: dropInfo.roomNo || slot.roomNo,
    };

    const targetWeek = rescheduleActionType === 'ADD_EXTRA' ? 'next' : currentMode;
    const targetScope =
      currentMode === 'base'
        ? 'PERMANENT'
        : rescheduleActionType === 'ADD_EXTRA'
        ? 'NEXT_WEEK'
        : 'CURRENT_WEEK';

    const placement = {
      actionType: rescheduleActionType,
      originalSlot: slot,
      targetSlot,
      week: targetWeek,
      scope: targetScope,
    };

    try {
      showToast('Checking schedule conflicts...', false);
      const valRes = await ApiService.validateDrop(placement);

      if (valRes.isAvailable) {
        setPendingPlacement(placement);
      } else if (valRes.isRoomOnlyConflict) {
        // Fetch vacant rooms
        const roomsRes = await ApiService.getAvailableRooms(
          targetSlot.day,
          targetSlot.starting,
          targetSlot.ending,
          currentMode
        );
        setAvailableRooms(roomsRes.rooms || []);
        setPendingPlacement(placement);
        setRoomConflictData(valRes);
      } else {
        const errMsg = (valRes.errors && valRes.errors[0]) || 'Schedule conflict detected. Drop rejected.';
        showToast(errMsg, true);
      }
    } catch (err) {
      console.error('[useTimetable] Validate drop failed', err);
      showToast('Failed to validate drop placement.', true);
    }
  };

  const commitMoveOrAdd = async (placement) => {
    setMutating(true);
    try {
      const res = await ApiService.moveOrAddSlot(placement);
      if (res.success) {
        showToast(res.message || 'Timetable updated successfully.');
        exitRescheduleMode();
        await loadGrid();
      } else {
        showToast(res.error || 'Unable to update timetable.', true);
      }
    } catch (err) {
      console.error('[useTimetable] Move failed', err);
      showToast('Error committing timetable update.', true);
    } finally {
      setMutating(false);
    }
  };

  const reassignRoomAndDrop = (newRoomNo) => {
    if (!pendingPlacement) return;
    const updatedPlacement = {
      ...pendingPlacement,
      targetSlot: {
        ...pendingPlacement.targetSlot,
        roomNo: newRoomNo,
      },
    };
    setRoomConflictData(null);
    handleSlotDrop({
      slot: updatedPlacement.originalSlot,
      day: updatedPlacement.targetSlot.day,
      starting: updatedPlacement.targetSlot.starting,
      ending: updatedPlacement.targetSlot.ending,
      roomNo: newRoomNo,
    });
  };

  const executeCancel = async (slot) => {
    const payload = {
      slot,
      week: currentMode,
      scope: currentMode === 'base' ? 'PERMANENT' : currentMode === 'next' ? 'NEXT_WEEK' : 'CURRENT_WEEK',
    };

    setMutating(true);
    try {
      const res = await ApiService.cancelSlot(payload);
      if (res.success) {
        showToast(res.message || 'Class cancelled successfully.');
        setCancelSlotTarget(null);
        await loadGrid();
      } else {
        showToast(res.error || 'Unable to cancel class.', true);
      }
    } catch (err) {
      console.error('[useTimetable] Cancel failed', err);
      showToast('Error cancelling class.', true);
    } finally {
      setMutating(false);
    }
  };

  return {
    workflowContext,
    simulatedDay,
    setSimulatedDay,
    currentView,
    setCurrentView,
    currentMode,
    setCurrentMode,
    entities,
    selectedEntityId,
    setSelectedEntityId,
    gridData,
    loading,
    mutating,
    rescheduleMode,
    rescheduleActionType,
    unlockedSlot,
    selectedActionSlot,
    setSelectedActionSlot,
    cancelSlotTarget,
    setCancelSlotTarget,
    pendingPlacement,
    setPendingPlacement,
    roomConflictData,
    setRoomConflictData,
    availableRooms,
    toast,
    handleClassClick,
    handleActionSelect,
    exitRescheduleMode,
    handleSlotDrop,
    commitMoveOrAdd,
    reassignRoomAndDrop,
    executeCancel,
  };
}
