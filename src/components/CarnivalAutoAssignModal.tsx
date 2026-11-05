import React from 'react';
import { Person, ConfigurableShift, Shift, PhysicalBase } from '../types';
import { CheckCircle2, X, Sparkles, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

export interface CarnivalPosteriorShiftStatus {
  shift: ConfigurableShift | Shift;
  turnNumber: number;
  isAvailable: boolean;
  unavailableReason?: string;
  alreadyAssignedSameBase?: boolean;
}

export interface CarnivalAutoPromptData {
  candidate: Person;
  currentShift: ConfigurableShift | Shift;
  currentTurnNumber: number;
  targetBase?: PhysicalBase | null;
  groupType?: 'GAP' | 'GT' | 'MESA';
  gtSubTeam?: string;
  fnName: string;
  eligibleShifts: (ConfigurableShift | Shift)[];
  allPosteriorStatuses: CarnivalPosteriorShiftStatus[];
}

interface CarnivalAutoAssignModalProps {
  promptData: CarnivalAutoPromptData;
  isSubmitting: boolean;
  onConfirmAll: () => Promise<void>;
  onConfirmCurrentOnly: () => Promise<void>;
  onClose: () => void;
}

export const CarnivalAutoAssignModal: React.FC<CarnivalAutoAssignModalProps> = ({
  promptData,
  isSubmitting,
  onConfirmAll,
  onConfirmCurrentOnly,
  onClose,
}) => {
  const {
    candidate,
    currentShift,
    targetBase,
    groupType = targetBase ? 'GAP' : 'GT',
    gtSubTeam,
    fnName,
    eligibleShifts,
    allPosteriorStatuses,
  } = promptData;
  const totalTurnsIfAll = eligibleShifts.length + 1;
  const isMultiple = eligibleShifts.length > 1;
  const isGt = groupType === 'GT' || (!targetBase && !currentShift.hasBases);

  return (
    <div
      id="carnival-auto-assign-backdrop"
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-tinta-900/65 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="carnival-auto-assign-card"
        className={`bg-surface border-2 ${
          isGt ? 'border-tinta-900' : 'border-lila-600'
        } rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-5 relative animate-in zoom-in-95 duration-200`}
      >
        {/* Close icon */}
        <button
          type="button"
          id="btn-close-carnival-auto-modal"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-tinta-500 hover:text-tinta-900 p-1.5 rounded-xl hover:bg-tinta-50 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top badge */}
        <div className="flex items-center gap-2">
          {isGt ? (
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-tinta-900 text-white border border-tinta-800 font-sans flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              GT • Asignación Inteligente Multi-Turno
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-lila-50 text-lila-600 border border-lila-200 font-sans flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-lila-600" />
              Carnival GAP • Asignación Inteligente
            </span>
          )}
        </div>

        {/* Person Name & Selection Header */}
        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-bold text-tinta-900 font-display tracking-wide leading-snug">
            {candidate.name.toUpperCase()}
          </h3>
          <p className="text-xs text-tinta-500 font-sans">
            Documento: <span className="font-mono text-tinta-900">{candidate.documentId}</span>
            {candidate.gtSubTeam && (
              <span className="ml-2 px-2 py-0.5 rounded-md bg-tinta-50 border border-tinta-200 text-[10px] font-bold text-tinta-900">
                Equipo: {candidate.gtSubTeam}
              </span>
            )}
          </p>
        </div>

        {/* Current Shift & Base/Subteam Context */}
        <div className="bg-tinta-50 border border-tinta-200 rounded-2xl p-3.5 space-y-2 text-xs font-sans">
          <div className="text-[11px] font-bold text-tinta-400 uppercase tracking-wider">
            Has seleccionado:
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-tinta-900 block text-sm">
                {currentShift.dayId === 'miercoles' ? 'CARNIVAL — ' : ''}
                {currentShift.name.toUpperCase()}
              </span>
              <span className="text-tinta-500 text-xs">
                {currentShift.label || `${currentShift.startTime} a ${currentShift.endTime}`}
              </span>
            </div>
            <div className="sm:text-right">
              {targetBase ? (
                <span className="px-2.5 py-1 rounded-lg bg-surface border border-tinta-200 text-lila-600 font-bold text-xs inline-block">
                  {targetBase.name}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-tinta-900 text-white font-bold text-xs inline-block">
                  GT: {gtSubTeam || 'Staff General'}
                </span>
              )}
              {fnName && (
                <div className="text-[11px] text-tinta-500 mt-0.5">Función: {fnName}</div>
              )}
            </div>
          </div>
        </div>

        {/* Availability Detection Message */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-tinta-900 font-sans">
            {isMultiple
              ? `Esta persona también está disponible para los siguientes turnos de ${isGt ? 'GT' : 'Carnival'}:`
              : `Esta persona también está disponible para:`}
          </p>

          <div className="space-y-2">
            {/* Eligible shifts */}
            {eligibleShifts.map((shift) => (
              <div
                key={shift.id}
                className="flex items-center justify-between p-3 rounded-xl bg-turquesa-50 border border-turquesa-200 text-xs font-sans"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-turquesa-600 shrink-0" />
                  <div>
                    <span className="font-bold text-turquesa-700">
                      {shift.name}
                    </span>
                    <span className="text-turquesa-600 text-[11px] ml-1.5">
                      ({shift.label || `${shift.startTime} a ${shift.endTime}`})
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-turquesa-700 bg-white/70 px-2 py-0.5 rounded-md border border-turquesa-200">
                  {targetBase ? targetBase.name : (gtSubTeam ? `GT ${gtSubTeam}` : 'GT')}
                </span>
              </div>
            ))}

            {/* Ineligible posterior shifts with precise reason */}
            {allPosteriorStatuses
              .filter((s) => !s.isAvailable)
              .map((ineligible) => (
                <div
                  key={ineligible.shift.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-mostaza-50 border border-mostaza-300/30 text-xs font-sans text-mostaza-800"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-mostaza-500 shrink-0" />
                    <span className="font-semibold">{ineligible.shift.name}:</span>
                    <span className="text-[11px] text-mostaza-700">
                      {ineligible.unavailableReason || 'No disponible'}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-mostaza-700">
                    No elegible
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Confirmation Question */}
        <div className="pt-2 border-t border-tinta-200">
          <p className="text-xs sm:text-sm font-semibold text-tinta-900 font-sans text-center">
            {targetBase ? (
              isMultiple
                ? `¿Deseas asignarla automáticamente a los ${totalTurnsIfAll} turnos manteniendo la misma base?`
                : `¿Deseas asignarla también a este turno manteniendo la misma base?`
            ) : (
              isMultiple
                ? `¿Deseas asignarla automáticamente a los ${totalTurnsIfAll} turnos de GT con el mismo equipo (${gtSubTeam || 'GT'}) y función?`
                : `¿Deseas asignarla también a este turno de GT con el mismo equipo (${gtSubTeam || 'GT'}) y función?`
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          {/* Primary Action: Assign to All / Both */}
          <button
            type="button"
            id="btn-assign-all-carnival-shifts"
            disabled={isSubmitting}
            onClick={onConfirmAll}
            className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl ${
              isGt
                ? 'bg-tinta-900 hover:bg-tinta-800 active:bg-tinta-950'
                : 'bg-lila-600 hover:bg-lila-700 active:bg-lila-800'
            } text-white font-bold text-xs font-sans shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Asignando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isMultiple
                    ? `ASIGNAR A LOS ${totalTurnsIfAll} TURNOS`
                    : 'ASIGNAR A AMBOS TURNOS'}
                </span>
              </>
            )}
          </button>

          {/* Secondary Action: Only current shift */}
          <button
            type="button"
            id="btn-assign-only-current-carnival-shift"
            disabled={isSubmitting}
            onClick={onConfirmCurrentOnly}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-tinta-50 hover:bg-tinta-100 active:bg-tinta-200 text-tinta-900 border border-tinta-200 font-bold text-xs font-sans flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>
              SOLO {currentShift.name.toUpperCase()}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
