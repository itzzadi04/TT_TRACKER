import React, { useState } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import TimetableToolbar from './components/controls/TimetableToolbar';
import TimetableGrid from './components/timetable/TimetableGrid';
import GuidelinesView from './components/guidelines/GuidelinesView';
import ClassActionModal from './components/modals/ClassActionModal';
import CancelConfirmModal from './components/modals/CancelConfirmModal';
import RoomConflictModal from './components/modals/RoomConflictModal';
import DropConfirmModal from './components/modals/DropConfirmModal';
import DragBanner from './components/feedback/DragBanner';
import Toast from './components/feedback/Toast';
import LoadingOverlay from './components/feedback/LoadingOverlay';
import { useTimetable } from './hooks/useTimetable';

export default function App() {
  const [activeNav, setActiveNav] = useState('sections');

  const {
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
  } = useTimetable();

  // Synchronize top navigation selection
  const handleNavSelect = (navKey) => {
    exitRescheduleMode();
    if (navKey === 'guidelines') {
      setActiveNav('guidelines');
    } else if (navKey === 'faculty') {
      setActiveNav('faculty');
      setCurrentView('faculty');
    } else if (navKey === 'sections') {
      setActiveNav('sections');
      setCurrentView('section');
    } else if (navKey === 'rooms') {
      setActiveNav('rooms');
      setCurrentView('room');
    } else if (navKey === 'timetable') {
      setActiveNav('timetable');
      setCurrentView('section');
    } else if (navKey === 'home') {
      setActiveNav('home');
      setCurrentView('section');
    }
  };

  return (
    <div className="app-root">
      {/* 1. Two-Tier Institutional Header with Unified Navigation */}
      <Header activeNav={activeNav} onNavSelect={handleNavSelect} />

      {/* 2. Main Content Canvas */}
      <main className="studio-canvas">
        {/* Active Reschedule Drag Banner */}
        <DragBanner
          rescheduleMode={rescheduleMode}
          rescheduleActionType={rescheduleActionType}
          unlockedSlot={unlockedSlot}
          onCancel={exitRescheduleMode}
        />

        {/* Toast Notifications */}
        <Toast toast={toast} />

        {activeNav === 'guidelines' ? (
          /* Dedicated Guidelines View */
          <GuidelinesView onBackToTimetable={() => handleNavSelect('sections')} />
        ) : (
          /* Academic Timetable Studio */
          <>
            {/* Toolbar Controls (Focusing on entity selection & week schedule mode) */}
            <TimetableToolbar
              currentView={currentView}
              currentMode={currentMode}
              onModeChange={(mode) => {
                exitRescheduleMode();
                setCurrentMode(mode);
              }}
              entities={entities}
              selectedEntityId={selectedEntityId}
              onEntityChange={(id) => {
                exitRescheduleMode();
                setSelectedEntityId(id);
              }}
              workflowContext={workflowContext}
              simulatedDay={simulatedDay}
              onSimulatedDayChange={setSimulatedDay}
            />

            {/* Timetable Grid Matrix */}
            <TimetableGrid
              gridData={gridData}
              currentView={currentView}
              rescheduleMode={rescheduleMode}
              unlockedSlot={unlockedSlot}
              onClassClick={handleClassClick}
              onSlotDrop={handleSlotDrop}
            />
          </>
        )}
      </main>

      {/* 3. Modals & Dialogs */}
      <ClassActionModal
        slot={selectedActionSlot}
        currentMode={currentMode}
        workflowContext={workflowContext}
        onClose={() => setSelectedActionSlot(null)}
        onActionSelect={handleActionSelect}
      />

      <CancelConfirmModal
        slot={cancelSlotTarget}
        currentMode={currentMode}
        onKeep={() => setCancelSlotTarget(null)}
        onConfirm={executeCancel}
      />

      <RoomConflictModal
        conflictData={roomConflictData}
        availableRooms={availableRooms}
        onCancel={() => setRoomConflictData(null)}
        onReassign={reassignRoomAndDrop}
      />

      <DropConfirmModal
        pendingPlacement={pendingPlacement && !roomConflictData ? pendingPlacement : null}
        currentMode={currentMode}
        onCancel={() => setPendingPlacement(null)}
        onConfirm={commitMoveOrAdd}
      />

      {/* 4. Institutional Footer */}
      <Footer onNavSelect={handleNavSelect} />

      {/* Loading Overlay — shown while a reschedule/cancel/add-extra is committing */}
      <LoadingOverlay show={mutating} />
    </div>
  );
}
