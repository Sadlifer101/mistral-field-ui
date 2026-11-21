import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from 'react';
import { ChevronRight, FileText, Activity, ScanLine, Maximize2, X } from 'lucide-react';
import { glass, type ThemeMode } from '../theme/glass';
import { SpecialistDialog } from './SpecialistDialog';
import {
  levelFromScreening,
  type LogbookDocument,
  type PatientLogbook,
  type ScreeningId,
} from '../lib/clinical';

// UI Forge Motion Primitives Disclosure: collapse height and fade within an overflow clip.
function HistoryReveal({ id, children }: { id: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const present = useIsPresent();
  return (
    <motion.div id={id} inert={!present} className="overflow-hidden"
      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

/** Clinical status tone for a screening dot, using the console's priority palette. */
function visitTone(level: string) {
  return level === 'urgent' ? 'urgent' : level === 'normal' ? 'normal' : 'monitor';
}

export function LongitudinalLogbook({ logbook, activeScreeningId, onOpenScreening, theme }: {
  logbook: PatientLogbook;
  activeScreeningId: ScreeningId | null;
  onOpenScreening: (screeningId: ScreeningId) => void;
  theme: ThemeMode;
}) {
  const [expandedVisitId, setExpandedVisitId] = useState<ScreeningId | null>(activeScreeningId);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [modalDoc, setModalDoc] = useState<LogbookDocument | null>(null);
  const { screenings, documents } = logbook;

  return (
    <section aria-label="Longitudinal Patient Logbook" className="sp-history">
      <div className="sp-history-head">
        <div>
          <h2>History &amp; documents</h2>
          <p className="sp-history-sub">Screening history, clinical briefs, and attached documents</p>
        </div>
        <span className="sp-history-count">
          {screenings.length} visits · {documents.length} docs
        </span>
      </div>

      {screenings.length === 0 ? (
        <p className="sp-secondary">No previous screenings.</p>
      ) : (
        <div className="sp-history-list">
          {screenings.map((visit) => {
            const isOpen = expandedVisitId === visit._id;
            const level = levelFromScreening(visit.level1Status, visit.riskScore);
            const isCurrent = visit._id === activeScreeningId;
            return (
              <div key={visit._id} className="sp-history-entry">
                <button
                  type="button"
                  onClick={() => setExpandedVisitId(isOpen ? null : visit._id)}
                  aria-expanded={isOpen}
                  aria-controls={`visit-details-${visit._id}`}
                  className="sp-history-toggle"
                >
                  <span className="sp-history-dot" data-tone={visitTone(level)} data-current={isCurrent} aria-hidden="true" />
                  <span className="sp-history-when">
                    {Number.isFinite(visit._creationTime) ? new Date(visit._creationTime).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }) : 'Date unavailable'}
                  </span>
                  <span className="sp-history-state">
                    {isCurrent ? 'Current screening' : visit.reviewStatus === 'reviewed' ? 'Signed off' : visit.reviewStatus === 'physical_referral' ? 'Physical referral' : 'Awaiting review'}
                  </span>
                  <span className="sp-history-risk">Risk {visit.riskScore ?? '—'}</span>
                  <ChevronRight aria-hidden="true" className="sp-history-chevron" size={15} />
                </button>
                <AnimatePresence initial={false}>{isOpen && (
                  <HistoryReveal id={`visit-details-${visit._id}`}>
                    <div className="sp-history-body">
                      <p className="sp-history-brief">
                        {visit.aiClinicalBrief ?? 'No clinical brief stored for this visit.'}
                      </p>
                      {visit.specialistRemarks && (
                        <p>Specialist: {visit.specialistRemarks}</p>
                      )}
                      {!isCurrent && <button type="button" className="sp-text-action" onClick={() => onOpenScreening(visit._id)}>Open screening</button>}
                      <p className="sp-history-audio">
                        Cough audio {visit.coughAudioUrl ? 'available' : 'not stored'} · Speech audio{' '}
                        {visit.speechAudioUrl ? 'available' : 'not stored'}
                      </p>
                    </div>
                  </HistoryReveal>
                )}</AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <div className="sp-history-docs">
        <h3>Attached PHC clinical documents &amp; imaging</h3>
        {documents.length === 0 ? (
          <p className="sp-secondary">No documents attached.</p>
        ) : (
          <div className="sp-history-doc-list">
            {documents.map((doc) => {
              const isDocOpen = expandedDocId === doc._id;
              return (
                <div key={doc._id} className="sp-history-doc">
                  <div className="sp-history-doc-row">
                    <button
                      type="button"
                      onClick={() => setExpandedDocId(isDocOpen ? null : doc._id)}
                      aria-expanded={isDocOpen}
                      aria-controls={`document-details-${doc._id}`}
                      className="sp-history-doc-open"
                    >
                      <DocumentTypeIcon type={doc.docType} />
                      <span className="sp-history-doc-meta">
                        <strong>{doc.fileName}</strong>
                        <span>{doc.docType} · {new Date(doc.uploadedAt).toLocaleDateString('en-IN')}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalDoc(doc)}
                      className="sp-history-action"
                    >
                      <Maximize2 size={12} aria-hidden="true" />
                      <span>Preview</span>
                    </button>
                  </div>
                  <AnimatePresence initial={false}>{isDocOpen && (
                    <HistoryReveal id={`document-details-${doc._id}`}><DocumentPreview doc={doc} /></HistoryReveal>
                  )}</AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>{modalDoc && (
        <SpecialistDialog titleId="sp-document-title" onClose={() => setModalDoc(null)} style={glass(theme).panel}>
          <div className="sp-dialog-section sp-dialog-head">
            <div>
              <h4 id="sp-document-title" className="sp-dialog-title">{modalDoc.fileName}</h4>
              <p className="sp-dialog-meta">{modalDoc.docType}</p>
            </div>
            <button type="button" onClick={() => setModalDoc(null)} aria-label="Close document preview" className="sp-dialog-close">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="sp-dialog-section">
            <DocumentPreview doc={modalDoc} />
          </div>
        </SpecialistDialog>
      )}</AnimatePresence>
    </section>
  );
}

function DocumentTypeIcon({ type }: { type: LogbookDocument['docType'] }) {
  return (
    <span className="sp-doc-icon" data-type={type} aria-hidden="true">
      {type === 'xray'
        ? <ScanLine size={16} />
        : type === 'lab_report'
          ? <Activity size={16} />
          : <FileText size={16} />}
    </span>
  );
}

function DocumentPreview({ doc }: { doc: LogbookDocument }) {
  const isImage = doc.fileUrl ? /\.(png|jpe?g|gif|webp)(\?|$)/i.test(doc.fileUrl) || doc.docType === 'xray' : false;
  return (
    <div className="sp-doc-preview">
      {doc.notes && <p>{doc.notes}</p>}
      {doc.fileUrl && isImage && (
        <img src={doc.fileUrl} alt={doc.fileName} />
      )}
      {doc.fileUrl ? (
          <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="sp-history-link">
            Open {doc.fileName}
          </a>
      ) : (
        <p className="sp-secondary">File URL is not available.</p>
      )}
    </div>
  );
}
