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
  targetBase: PhysicalBase;
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
  const { candidate, currentShift, targetBase, fnName, eligibleShifts, allPosteriorStatuses } = promptData;
  const totalTurnsIfAll = eligibleShifts.length + 1;
  const isMultiple = eligibleShifts.length > 1;

  return (
    <div
      id="carnival-auto-assign-backdrop"
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-[#182535]/65 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="carnival-auto-assign-card"
        className="bg-[#FFFDF8] border-2 border-[#B83A24] rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-5 relative animate-in zoom-in-95 duration-200"
      >
        {/* Close icon */}
        <button
          type="button"
          id="btn-close-carnival-auto-modal"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-[#64748B] hover:text-[#182535] p-1.5 rounded-xl hover:bg-[#FAF6EC] transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top badge */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA] font-montserrat flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#B83A24]" />
            Carnival GAP • Asignación Inteligente
          </span>
        </div>

        {/* Person Name & Selection Header */}
        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-bold text-[#182535] font-dalek tracking-wide leading-snug">
            {candidate.name.toUpperCase()}
          </h3>
          <p className="text-xs text-[#64748B] font-montserrat">
            Documento: <span className="font-mono text-[#182535]">{candidate.documentId}</span>
          </p>
        </div>

        {/* Current Shift & Base Context */}
        <div className="bg-[#FAF6EC] border border-[#EADDC7] rounded-2xl p-3.5 space-y-2 text-xs font-montserrat">
          <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
            Has seleccionado:
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-[#182535] block text-sm">
                CARNIVAL — {currentShift.name.toUpperCase()}
              </span>
              <span className="text-[#64748B] text-xs">
                {currentShift.label || `${currentShift.startTime} a ${currentShift.endTime}`}
              </span>
            </div>
            <div className="sm:text-right">
              <span className="px-2.5 py-1 rounded-lg bg-[#FFFDF8] border border-[#EADDC7] text-[#B83A24] font-bold text-xs inline-block">
                {targetBase.name}
              </span>
              {fnName && (
                <div className="text-[11px] text-[#64748B] mt-0.5">Rol: {fnName}</div>
              )}
            </div>
          </div>
        </div>

        {/* Availability Detection Message */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-[#182535] font-montserrat">
            {isMultiple
              ? 'Esta persona también está disponible para los siguientes turnos de Carnival:'
              : `Esta persona también está disponible para:`}
          </p>

          <div className="space-y-2">
            {/* Eligible shifts */}
            {eligibleShifts.map((shift) => (
              <div
                key={shift.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-xs font-montserrat"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                  <div>
                    <span className="font-bold text-[#166534]">
                      {shift.name}
                    </span>
                    <span className="text-[#15803D] text-[11px] ml-1.5">
                      ({shift.label || `${shift.startTime} a ${shift.endTime}`})
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#166534] bg-white/70 px-2 py-0.5 rounded-md border border-[#BBF7D0]">
                  {targetBase.name}
                </span>
              </div>
            ))}

            {/* Ineligible posterior shifts with precise reason */}
            {allPosteriorStatuses
              .filter((s) => !s.isAvailable)
              .map((ineligible) => (
                <div
                  key={ineligible.shift.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#FEF8EC] border border-[#E5A12E]/30 text-xs font-montserrat text-[#854D0E]"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
                    <span className="font-semibold">{ineligible.shift.name}:</span>
                    <span className="text-[11px] text-[#A16207]">
                      {ineligible.unavailableReason || 'No disponible'}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-[#B45309]">
                    No elegible
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Confirmation Question */}
        <div className="pt-2 border-t border-[#EADDC7]">
          <p className="text-xs sm:text-sm font-semibold text-[#182535] font-montserrat text-center">
            {isMultiple
              ? `¿Deseas asignarla automáticamente a los ${totalTurnsIfAll} turnos manteniendo la misma base?`
              : `¿Deseas asignarla también a este turno manteniendo la misma base?`}
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
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#B83A24] hover:bg-[#9E2F1B] active:bg-[#852515] text-white font-bold text-xs font-montserrat shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                    : 'ASIGNAR TAMBIÉN'}
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
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#FAF6EC] hover:bg-[#F3ECE0] active:bg-[#EBDDC7] text-[#182535] border border-[#EADDC7] font-bold text-xs font-montserrat flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
