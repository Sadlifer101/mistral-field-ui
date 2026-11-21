import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { api } from "@convex/api";
import { displayName, type PatientId } from "../lib/clinical";
import { glass, type ThemeMode } from "../theme/glass";
import { SpecialistSearch } from "./TriageQueueColumn";

export function PatientDirectoryList({ theme, searchQuery, onSearchChange, onSelectPatient }: {
  theme: ThemeMode;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectPatient: (patientId: PatientId) => void;
}) {
  const search = searchQuery.trim();
  const patients = useQuery(api.triageLogbook.searchOrListPatients, search ? { search } : {});
  return (
    <>
      <header className="sp-page-title">
        <h1 data-view-heading tabIndex={-1}>Patients</h1>
        <p>Open a patient record to see screenings, clinical notes and documents.</p>
      </header>
      <section className="sp-list" style={glass(theme).panel} aria-label="Patient directory">
        <div className="sp-list-top">
          <div><h2>Patient directory</h2><p>{search ? "Search results" : "Recently registered"}</p></div>
          <SpecialistSearch label="Search patient directory" value={searchQuery} onChange={onSearchChange} />
        </div>
        {patients === undefined ? <p className="sp-list-empty" role="status">Loading patient records…</p> : patients.length === 0 ? (
          <p className="sp-list-empty">{search ? "No patients match your search." : "No registered patients."}</p>
        ) : (
          <ul>
            {patients.map((patient) => (
              <li key={patient._id}>
                <button type="button" id={`sp-case-${patient._id}`} className="sp-case-row sp-row-button" onClick={() => onSelectPatient(patient._id)}>
                  <span className="sp-case-identity">
                    <strong>{displayName(patient.fullName, "Unnamed patient")}</strong>
                    <small>{patient.patientCode ?? "No patient code"}</small>
                  </span>
                  <span className="sp-case-complaint">{patient.village || "Village unrecorded"}</span>
                  <span>{patient.age} yrs · {patient.sex}</span>
                  <ArrowUpRight size={18} className="sp-row-arrow" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
