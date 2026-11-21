import { useEffect, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@convex/api";
import { ResonanceCanvas } from "./components/ResonanceCanvas";
import { WelcomeAuthPage } from "./components/WelcomeAuthPage";
import { TopTelemetryHeader } from "./components/TopTelemetryHeader";
import { SpecialistConsole } from "./components/SpecialistConsole";
import { MobileNurseApp } from "./components/MobileNurseApp";

type ThemeName = "light" | "dark";

function getInitialTheme(): ThemeName {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("mistral_theme");
  return stored === "light" ? "light" : "dark";
}

function readNurseSurface(): boolean {
  if (typeof window === "undefined") return false;
  return /^\/nurse(?:[./]|$)/.test(window.location.pathname);
}

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const upsertStaffProfile = useMutation(api.triageLogbook.upsertStaffProfile);
  const [nurseSurface, setNurseSurface] = useState(() => readNurseSurface());
  const specialistProfile = useQuery(
    api.triageLogbook.getMyStaffProfile,
    isAuthenticated && !nurseSurface ? { role: "city_specialist" } : "skip",
  );
  const nurseProfile = useQuery(
    api.triageLogbook.getMyStaffProfile,
    isAuthenticated && nurseSurface ? { role: "nurse" } : "skip",
  );
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);

  useEffect(() => {
    const sync = () => setNurseSurface(readNurseSurface());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !nurseSurface || nurseProfile === undefined || nurseProfile !== null) return;
    void upsertStaffProfile({
      role: "nurse",
      fullName: "helena",
      facilityName: "Rural PHC Field Unit",
      district: "Satara",
    });
  }, [isAuthenticated, nurseSurface, nurseProfile, upsertStaffProfile]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("mistral_theme", theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleSignOut = () => {
    void signOut();
  };

  const sessionReady = isAuthenticated && specialistProfile !== undefined;
  const needsSpecialistOnboarding = sessionReady && specialistProfile === null && !nurseSurface;
  const showConsole = sessionReady && specialistProfile !== null && !nurseSurface;

  if (nurseSurface && isAuthenticated) {
    if (nurseProfile === undefined || nurseProfile === null) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-[#FAF9F6] px-6 text-xs font-medium text-[#111315]/75">
          Opening PHC field unit...
        </div>
      );
    }
    return <MobileNurseApp nurse={nurseProfile} onSignOut={handleSignOut} />;
  }

  return (
    <div
      className="relative min-h-screen text-[#111315] dark:text-[#F8FAFC] transition-colors"
      style={{ backgroundColor: theme === "dark" ? "transparent" : "#FAF9F6" }}
    >
      {!nurseSurface && !showConsole && (
        <ResonanceCanvas
          mode="welcome"
          theme={theme}
          riskScore={null}
          level1Status={null}
          isPlaying={false}
          playbackProgress={0}
        />
      )}

      {isLoading || (isAuthenticated && specialistProfile === undefined) ? (
        <div className="relative z-10 flex min-h-dvh items-center justify-center px-6">
          <div className="rounded-xl border border-[#111315]/12 dark:border-white/14 bg-[#FFFFFF]/85 dark:bg-[#111827]/85 backdrop-blur-md px-6 py-4 text-xs font-medium text-[#111315]/80 dark:text-[#F1F5F9]/85">
            Restoring specialist clinical session...
          </div>
        </div>
      ) : !isAuthenticated ? (
        <WelcomeAuthPage theme={theme} onToggleTheme={handleToggleTheme} compact={nurseSurface} />
      ) : needsSpecialistOnboarding ? (
        <SpecialistOnboarding
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onSignOut={handleSignOut}
          role="city_specialist"
        />
      ) : (
        <SpecialistConsole
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onSignOut={handleSignOut}
          doctorName={specialistProfile?.fullName || "Specialist Physician"}
          district={specialistProfile?.district ?? ""}
        />
      )}
    </div>
  );
}

function SpecialistOnboarding({
  theme,
  onToggleTheme,
  onSignOut,
  role,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSignOut: () => void;
  role: "nurse" | "city_specialist";
}) {
  const upsertProfile = useMutation(api.triageLogbook.upsertStaffProfile);
  const [fullName, setFullName] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [district, setDistrict] = useState("");
  const [hprRegistrationId, setHprRegistrationId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const name = fullName.trim();
    const facility = facilityName.trim();
    const districtName = district.trim();
    if (!name || !facility || !districtName) {
      setErrorMessage("Full name, facility, and district are required.");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const hpr = hprRegistrationId.trim();
      await upsertProfile({
        role,
        fullName: name,
        facilityName: facility,
        district: districtName,
        ...(hpr ? { hprRegistrationId: hpr } : {}),
        ...(phoneNumber.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save the specialist profile.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <TopTelemetryHeader theme={theme} onToggleTheme={onToggleTheme} onSignOut={onSignOut} />
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="w-full max-w-lg rounded-2xl border border-[#111315]/14 dark:border-white/15 bg-[#FFFFFF]/90 dark:bg-[#111827]/88 backdrop-blur-md p-6 sm:p-8 space-y-5"
        >
          <div className="space-y-1.5">
            <p className="text-xs font-mono font-semibold text-[#0D9488] dark:text-[#2DD4BF]">
              {role === "nurse" ? "PHC nurse" : "City specialist"}
            </p>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {role === "nurse" ? "Nurse onboarding" : "Specialist onboarding"}
            </h1>
            <p className="text-sm text-[#111315]/70 dark:text-[#F1F5F9]/75">
              One step registers this Google account on the district triage logbook.
            </p>
          </div>

          <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Dr. Aarav Kulkarni" />
          <Field label="Facility" value={facilityName} onChange={setFacilityName} placeholder="District Hospital Satara" />
          <Field label="District" value={district} onChange={setDistrict} placeholder="Satara" />
          <Field label="Direct contact phone" value={phoneNumber} onChange={setPhoneNumber} placeholder="+91Ã¢â‚¬Â¦" optional />
          <Field
            label="HPR registration ID"
            value={hprRegistrationId}
            onChange={setHprRegistrationId}
            placeholder="Optional"
            optional
          />

          {errorMessage && (
            <p role="alert" className="text-xs text-[#E63946] dark:text-[#FF6B77]">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-lg bg-[#111315] dark:bg-[#F8FAFC] text-[#FAF9F6] dark:text-[#111315] text-xs font-bold tracking-tight hover:bg-[#111315]/88 dark:hover:bg-[#E2E8F0] transition-colors cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? "Saving profileÃ¢â‚¬Â¦" : "Enter triage workspace"}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  optional,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  optional?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold">
        {label}
        {optional ? <span className="font-normal text-[#111315]/50 dark:text-[#F1F5F9]/55"> Ã‚· optional</span> : null}
      </label>
      <input
        id={id}
        required={!optional}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-xs rounded-lg border border-[#111315]/18 dark:border-white/18 bg-[#FAF9F6] dark:bg-[#0B0F17]/80 text-[#111315] dark:text-[#F8FAFC] placeholder:text-[#111315]/40 dark:placeholder:text-[#F1F5F9]/40 focus:outline-none focus:border-[#111315] dark:focus:border-[#F8FAFC]"
      />
    </div>
  );
}
