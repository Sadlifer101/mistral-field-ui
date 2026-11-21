import { AnimatePresence } from "motion/react";
import { SpecialistDialog } from './SpecialistDialog';
import { useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  UserPlus,
  X,
} from 'lucide-react';
import { api } from '@convex/api';
import {
  displayName,
  levelFromScreening,
  type LogbookScreening,
  type PatientLogbook,
} from '../lib/clinical';
import { ACCENT, STATUS, glass, type ThemeMode } from '../theme/glass';
import { analyzeClinicalAcoustics } from '../utils/clinicalAcousticEngine';
import { locateNearestFacility } from '../utils/nearestFacilityLocator';

interface SpecialistSignOffPanelProps {
  patient: PatientLogbook['patient'];
  screening: LogbookScreening;
  onSignedOff: (notice: string) => void;
  /** Optional so existing call sites keep working; the console is dark-first. */
  theme?: ThemeMode;
}

type StoredClinical = LogbookScreening & {
  symptomNotes?: string;
  spo2Percent?: number;
  respiratoryRate?: number;
  temperatureC?: number;
  provisionalMedication?: string;
  medicationApproved?: boolean;
  approvedMedication?: string;
  reviewedByName?: string;
  reviewedByPhone?: string;
  reviewedByFacility?: string;
  reviewedByDistrict?: string;
};

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B9A8D9]';

const FIELD_CLASS = `outline-none ${FOCUS_RING}`;

/**
 * The rail shows the two clinical actions exactly as the approved reference
 * does. The full sign-off record (remarks, referral flag, medication protocol,
 * reviewer contact, instructions) opens in a dialog so nothing that used to be
 * reachable on this screen has been dropped.
 */
export function SpecialistSignOffPanel({
  patient,
  screening,
  onSignedOff,
  theme = 'dark',
}: SpecialistSignOffPanelProps) {
  const tokens = glass(theme);
  const stored = screening as StoredClinical;
  const clinical = useMemo(
    () =>
      analyzeClinicalAcoustics({
        frequencyChartData: screening.frequencyChartData ?? null,
        spO2: stored.spo2Percent ?? null,
        respiratoryRate: stored.respiratoryRate ?? null,
        temperatureC: stored.temperatureC ?? null,
        age: patient.age,
        symptomNotes: stored.symptomNotes || screening.rawTranscript || '',
      }),
    [patient.age, screening, stored.respiratoryRate, stored.spo2Percent, stored.symptomNotes, stored.temperatureC],
  );
  const specialist = useQuery(api.triageLogbook.getMyStaffProfile, { role: 'city_specialist' });
  const submitReview = useMutation(api.triageLogbook.submitSpecialistReview);
  const nearest = useMemo(
    () =>
      locateNearestFacility({
        village: patient.village,
        district: stored.reviewedByDistrict || specialist?.district,
      }),
    [patient.village, specialist?.district, stored.reviewedByDistrict],
  );
  const [remarks, setRemarks] = useState(screening.specialistRemarks ?? '');
  const [physicalReferralFlag, setPhysicalReferralFlag] = useState(
    screening.physicalReferralFlag === true,
  );
  const [referralInstructions, setReferralInstructions] = useState(
    screening.referralInstructions ?? '',
  );
  const [prescription, setPrescription] = useState(
    stored.provisionalMedication || clinical.protocol.lines.join('\n'),
  );
  const [approveMedication, setApproveMedication] = useState(stored.medicationApproved === true);
  const [contactPhone, setContactPhone] = useState(
    stored.reviewedByPhone || specialist?.phoneNumber || '',
  );
  const [hospitalName, setHospitalName] = useState(
    stored.reviewedByFacility || specialist?.facilityName || '',
  );
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialog, setDialog] = useState<'signoff' | 'refer' | null>(null);
  const [primaryHovered, setPrimaryHovered] = useState(false);
  const [secondaryHovered, setSecondaryHovered] = useState(false);
  const saving = useRef(false);
  const level = levelFromScreening(screening.level1Status, screening.riskScore);
  const patientCode = patient.patientCode ?? 'SV';

  const closeDialog = () => {
    setDialog(null);
    setPhysicalReferralFlag(screening.physicalReferralFlag === true);
    setErrorMessage(null);
  };

  const openDialog = (mode: 'signoff' | 'refer') => {
    setPhysicalReferralFlag(mode === 'refer' || screening.physicalReferralFlag === true);
    setDialog(mode);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setErrorMessage(null);
    setIsSubmitting(true);
    const instructions = referralInstructions.trim();
    const medication = prescription.trim();
    if (approveMedication && !medication) {
      setErrorMessage('Enter the medication details before approving.');
      saving.current = false;
      setIsSubmitting(false);
      return;
    }
    try {
      await submitReview({
        screeningId: screening._id,
        specialistRemarks: remarks.trim(),
        physicalReferralFlag,
        ...(instructions ? { referralInstructions: instructions } : {}),
        ...(medication ? { provisionalMedication: medication } : {}),
        ...(approveMedication && medication ? { approvedMedication: medication } : {}),
        medicationApproved: approveMedication,
        ...(specialist?.fullName ? { reviewedByName: specialist.fullName } : {}),
        ...(contactPhone.trim() ? { reviewedByPhone: contactPhone.trim() } : {}),
        ...(hospitalName.trim() ? { reviewedByFacility: hospitalName.trim() } : {}),
        ...(specialist?.district ? { reviewedByDistrict: specialist.district } : {}),
      });
      const timestamp = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const notice = `Clinical sign-off saved for ${patientCode} (${displayName(patient.fullName, 'patient')})${
        physicalReferralFlag ? ' — flagged for mandatory physical referral.' : approveMedication ? ' — provisional PHC medication approved.' : '.'
      }`;
      setSubmittedNotice(`Signed off at ${timestamp}`);
      setDialog(null);
      onSignedOff(notice);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign-off could not be saved.');
    } finally {
      saving.current = false;
      setIsSubmitting(false);
    }
  };

  const fieldStyle: CSSProperties = {
    ...tokens.surface,
    width: '100%',
    borderRadius: 10,
    padding: '9px 11px',
    fontSize: 12.5,
    lineHeight: 1.5,
    color: tokens.text.primary,
    borderColor: tokens.hairline,
    resize: 'vertical',
  };

  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 11.5,
    fontWeight: 500,
    letterSpacing: '0.02em',
    color: tokens.text.secondary,
  };

  const captionStyle: CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: tokens.text.muted,
  };

  const clampStyle: CSSProperties = {
    fontSize: 12,
    lineHeight: 1.6,
    color: tokens.text.secondary,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  return (
    <>
      {/* ------------------------------------------------- rail actions -- */}
      <div className="flex flex-col" style={{ gap: 8 }}>
        <button
          type="button"
          onClick={() => openDialog('signoff')}
          onMouseEnter={() => setPrimaryHovered(true)}
          onMouseLeave={() => setPrimaryHovered(false)}
          onFocus={() => setPrimaryHovered(true)}
          onBlur={() => setPrimaryHovered(false)}
          className={`flex w-full min-w-0 cursor-pointer items-center justify-between overflow-hidden ${FOCUS_RING}`}
          style={{
            minHeight: 52,
            padding: '0 22px',
            borderRadius: 9999,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '-0.005em',
            background: primaryHovered ? ACCENT.actionHover : ACCENT.action,
            border: `1px solid ${ACCENT.border}`,
            color: '#1E172A',
            transition: 'background 160ms ease',
          }}
        >
          <span className="inline-flex min-w-0 items-center" style={{ gap: 10 }}>
            <Check size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span className="text-left" style={{ minWidth: 0 }}>
              {isSubmitting ? 'Saving sign-off…' : 'Sign-off / Approve Treatment'}
            </span>
          </span>
          <ArrowRight size={18} aria-hidden="true" style={{ flexShrink: 0, marginLeft: 8 }} />
        </button>

        <button
          type="button"
          onClick={() => openDialog('refer')}
          onMouseEnter={() => setSecondaryHovered(true)}
          onMouseLeave={() => setSecondaryHovered(false)}
          className={`flex w-full min-w-0 cursor-pointer items-center justify-between overflow-hidden ${FOCUS_RING}`}
          style={{
            minHeight: 52,
            padding: '0 22px',
            borderRadius: 9999,
            fontSize: 16,
            fontWeight: 500,
            background: secondaryHovered ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${physicalReferralFlag ? ACCENT.border : tokens.hairline}`,
            color: physicalReferralFlag ? ACCENT.text : tokens.text.primary,
            transition: 'background 160ms ease',
          }}
        >
          <span className="inline-flex min-w-0 items-center" style={{ gap: 10 }}>
            <UserPlus size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span className="text-left" style={{ minWidth: 0 }}>Refer / Escalate</span>
          </span>
          <ArrowRight size={18} aria-hidden="true" style={{ flexShrink: 0, marginLeft: 8 }} />
        </button>
      </div>

      {/* ------------------------------------------------------- dialog -- */}
      <AnimatePresence>{dialog !== null ? (
        <SpecialistDialog titleId="signoff-dialog-title" onClose={closeDialog} busy={isSubmitting}
          style={{ ...tokens.panel, maxWidth: 620, borderRadius: 22, padding: '24px 26px 26px' }}>
            <div className="flex items-start justify-between" style={{ gap: 12 }}>
              <div>
                <h3
                  id="signoff-dialog-title"
                  className="font-serif"
                  style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.01em' }}
                >
                  {dialog === 'refer' ? 'Refer / Escalate' : 'Specialist Sign-Off'}
                </h3>
                <p
                  className="font-mono tabular-nums"
                  style={{ marginTop: 4, fontSize: 11.5, color: tokens.text.muted }}
                >
                  {patientCode} · {displayName(patient.fullName, 'patient')} · {patient.age}
                  {patient.sex ? ` ${patient.sex}` : ''} · Risk {screening.riskScore ?? '—'}/100 ·{' '}
                  {level}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={isSubmitting}
                aria-label="Close sign-off"
                className={`grid shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-white/10 ${FOCUS_RING}`}
                style={{ width: 30, height: 30, color: tokens.text.secondary }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {clinical.signalWarning && (
              <p
                className="flex items-start"
                style={{ marginTop: 12, gap: 6, fontSize: 11.5, color: STATUS.high.text }}
              >
                <AlertTriangle size={12} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{clinical.signalWarning}</span>
              </p>
            )}

            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px solid ${tokens.hairline}`,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <div>
                <div style={captionStyle}>Acoustic correlation</div>
                <p title={clinical.brief.acoustic} style={{ ...clampStyle, marginTop: 4 }}>
                  {clinical.brief.acoustic}
                </p>
              </div>
              <div>
                <div style={captionStyle}>Next steps</div>
                <p title={clinical.brief.nextSteps} style={{ ...clampStyle, marginTop: 4 }}>
                  {clinical.brief.nextSteps}
                </p>
              </div>
            </div>

            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="flex flex-col"
              style={{ gap: 14, marginTop: 16 }}
            >
              <div>
                <label htmlFor="specialist-remarks" style={labelStyle}>
                  Specialist Remarks
                </label>
                <textarea
                  id="specialist-remarks"
                  autoFocus={dialog === 'signoff'}
                  rows={3}
                  value={remarks}
                  onChange={(e) => {
                    setRemarks(e.target.value);
                    setSubmittedNotice(null);
                  }}
                  placeholder="Document auscultation impression, acoustic correlation, and differential diagnosis..."
                  className={FIELD_CLASS}
                  style={{ ...fieldStyle, marginTop: 6 }}
                />
              </div>

              <div
                style={{
                  borderRadius: 12,
                  padding: 12,
                  border: `1px solid ${physicalReferralFlag ? STATUS.high.border : tokens.hairline}`,
                  background: physicalReferralFlag ? STATUS.high.bg : 'transparent',
                }}
              >
                <div className="flex items-center justify-between" style={{ gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <label
                      htmlFor="physical-referral-toggle"
                      className="cursor-pointer"
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 500,
                        color: physicalReferralFlag ? STATUS.high.text : tokens.text.primary,
                      }}
                    >
                      Flag for Mandatory Physical Hospital Referral
                    </label>
                    <p style={{ marginTop: 2, fontSize: 11, color: tokens.text.muted }}>
                      Escalates patient to District Hospital red-flag dispatch queue
                    </p>
                  </div>
                  <button
                    id="physical-referral-toggle"
                    type="button"
                    role="switch"
                    aria-checked={physicalReferralFlag}
                    aria-label="Flag for mandatory physical hospital referral"
                    onClick={() => {
                      setPhysicalReferralFlag((prev) => !prev);
                      setSubmittedNotice(null);
                    }}
                    className={`relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${FOCUS_RING}`}
                    style={{
                      height: 22,
                      width: 40,
                      background: physicalReferralFlag ? STATUS.high.dot : tokens.track,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none inline-block transform rounded-full transition-transform duration-150"
                      style={{
                        height: 18,
                        width: 18,
                        background: '#FFFFFF',
                        transform: physicalReferralFlag ? 'translateX(18px)' : 'translateX(0)',
                      }}
                    />
                  </button>
                </div>
                {physicalReferralFlag && (
                  <p
                    className="flex items-start"
                    style={{ marginTop: 8, gap: 6, fontSize: 11, color: STATUS.high.text }}
                  >
                    <AlertTriangle size={12} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span>Red-flag escalation active — PHC ANM will receive immediate SMS alert</span>
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between" style={{ gap: 10 }}>
                  <label htmlFor="phc-rx" style={labelStyle}>
                    Approved Medication Protocol
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setApproveMedication((prev) => !prev);
                      setSubmittedNotice(null);
                    }}
                    aria-pressed={approveMedication}
                    className={`cursor-pointer ${FOCUS_RING}`}
                    style={{
                      borderRadius: 999,
                      padding: '4px 10px',
                      fontSize: 10.5,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      border: `1px solid ${approveMedication ? ACCENT.border : tokens.hairline}`,
                      background: approveMedication ? ACCENT.washStrong : 'transparent',
                      color: approveMedication ? ACCENT.ink : tokens.text.secondary,
                    }}
                  >
                    {approveMedication ? 'Medication approved' : 'Approve provisional PHC medication'}
                  </button>
                </div>
                <textarea
                  id="phc-rx"
                  rows={3}
                  value={prescription}
                  onChange={(e) => {
                    setPrescription(e.target.value);
                    setSubmittedNotice(null);
                  }}
                  className={FIELD_CLASS}
                  style={{ ...fieldStyle, marginTop: 6 }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
                <div>
                  <label htmlFor="doc-phone" style={labelStyle}>
                    Contact Phone
                  </label>
                  <input
                    id="doc-phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => {
                      setContactPhone(e.target.value);
                      setSubmittedNotice(null);
                    }}
                    placeholder="+91…"
                    className={FIELD_CLASS}
                    style={{ ...fieldStyle, marginTop: 6 }}
                  />
                </div>
                <div>
                  <label htmlFor="doc-hospital" style={labelStyle}>
                    Hospital / Clinic
                  </label>
                  <input
                    id="doc-hospital"
                    type="text"
                    value={hospitalName}
                    onChange={(e) => {
                      setHospitalName(e.target.value);
                      setSubmittedNotice(null);
                    }}
                    placeholder="District Hospital Satara"
                    className={FIELD_CLASS}
                    style={{ ...fieldStyle, marginTop: 6 }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="referral-instructions" style={labelStyle}>
                  Referral Instructions
                </label>
                <input
                  id="referral-instructions"
                  autoFocus={dialog === 'refer'}
                  type="text"
                  value={referralInstructions}
                  onChange={(e) => {
                    setReferralInstructions(e.target.value);
                    setSubmittedNotice(null);
                  }}
                  placeholder={
                    physicalReferralFlag
                      ? 'e.g., Immediate Chest PA X-ray + Sputum CBNAAT at District Hospital'
                      : 'e.g., Continue inhaled bronchodilator; re-screen in 14 days'
                  }
                  className={FIELD_CLASS}
                  style={{ ...fieldStyle, marginTop: 6 }}
                />
              </div>

              <p style={{ fontSize: 11, lineHeight: 1.6, color: tokens.text.muted }}>
                {nearest.hospitalName} · {nearest.distanceKm} km · {nearest.specialistName} ·{' '}
                {nearest.phone}
              </p>

              {errorMessage && (
                <p role="alert" style={{ fontSize: 11.5, color: STATUS.high.text }}>
                  {errorMessage}
                </p>
              )}

              {(submittedNotice ||
                screening.reviewStatus === 'reviewed' ||
                screening.reviewStatus === 'physical_referral') && (
                <div
                  className="flex items-center justify-between font-mono"
                  style={{ gap: 8, fontSize: 11, color: STATUS.low.text }}
                >
                  <span className="inline-flex items-center" style={{ gap: 6, fontWeight: 500 }}>
                    <CheckCircle2 size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
                    <span>{submittedNotice ?? 'Specialist review on file'}</span>
                  </span>
                  <span style={{ textTransform: 'uppercase' }}>
                    {screening.reviewStatus ?? 'pending_review'}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end" style={{ gap: 10, marginTop: 2 }}>
                <button
                  type="button"
                  onClick={closeDialog}
                disabled={isSubmitting}
                  className={`cursor-pointer rounded-full px-4 py-2.5 text-[12.5px] ${FOCUS_RING}`}
                  style={{
                    border: `1px solid ${tokens.hairline}`,
                    color: tokens.text.secondary,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex cursor-pointer items-center rounded-full disabled:opacity-60 ${FOCUS_RING}`}
                  style={{
                    gap: 8,
                    height: 42,
                    padding: '0 20px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: ACCENT.action,
                    border: `1px solid ${ACCENT.border}`,
                    color: '#1E172A',
                  }}
                >
                  <Check size={15} aria-hidden="true" />
                  <span>{isSubmitting ? 'Saving…' : physicalReferralFlag ? 'Submit referral' : 'Submit sign-off'}</span>
                </button>
              </div>
            </form>
        </SpecialistDialog>
      ) : null}</AnimatePresence>
    </>
  );
}
