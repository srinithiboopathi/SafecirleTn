import React, { useState, useEffect } from 'react';
import { MapComponent } from '../components/MapComponent';
import { LocationAutocompleteInput } from '../components/LocationAutocompleteInput';
import { api } from '../services/api';
import { SafetyReport } from '../types';
import {
  isCoordinateInTamilNadu,
  resolveTamilNaduDistrict,
  TAMIL_NADU_DISTRICTS
} from '../utils/tamilNaduGeo';
import {
  AlertTriangle,
  MapPin,
  CheckCircle2,
  Shield,
  Clock,
  Send,
  X
} from 'lucide-react';

export const ReportSafetyPage: React.FC<{ userLocation: [number, number] }> = ({
  userLocation
}) => {
  const initialCoords: [number, number] = isCoordinateInTamilNadu(userLocation[0], userLocation[1])
    ? userLocation
    : [11.0168, 76.9558];

  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [selectedCoords, setSelectedCoords] = useState<[number, number]>(initialCoords);
  const [locationSearch, setLocationSearch] = useState('');
  const [issueType, setIssueType] = useState('lighting');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(3);
  const [anonymous, setAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getReports().then(setReports).catch(() => {});
  }, []);

  const currentDistrict = isCoordinateInTamilNadu(selectedCoords[0], selectedCoords[1])
    ? resolveTamilNaduDistrict(selectedCoords[0], selectedCoords[1])
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isCoordinateInTamilNadu(selectedCoords[0], selectedCoords[1])) {
      setErrorMessage('Please select a location inside Tamil Nadu.');
      return;
    }

    setSubmitting(true);
    try {
      const newRep = await api.submitReport({
        lat: selectedCoords[0],
        lng: selectedCoords[1],
        issueType,
        description,
        severity,
        anonymous
      } as any);
      setReports([newRep, ...reports]);
      setSubmitted(true);
      setDescription('');
      setTimeout(() => setSubmitted(false), 3500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent text-[#FAFAFA] p-3 sm:p-5">
      <div className="max-w-[1440px] mx-auto space-y-4">
        <div className="luxury-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Report Safety Issue</h1>
            <p className="text-xs text-[#A1A1AA]">
              Report unlit streets, road blocks, or hazards in Tamil Nadu
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="w-full md:w-72">
              <LocationAutocompleteInput
                value={locationSearch}
                onChange={setLocationSearch}
                placeholder="Search location to report..."
                onSelect={place => {
                  setErrorMessage(null);
                  setSelectedCoords([place.lat, place.lng]);
                }}
              />
            </div>

            <select
              value={currentDistrict?.id || 'coimbatore'}
              onChange={e => {
                const d = TAMIL_NADU_DISTRICTS.find(item => item.id === e.target.value);
                if (d) {
                  setErrorMessage(null);
                  setSelectedCoords([d.lat, d.lng]);
                }
              }}
              className="bg-[#111114] border border-[#303036] rounded-xl px-3 py-2.5 text-xs text-[#FAFAFA] focus:outline-none"
            >
              {TAMIL_NADU_DISTRICTS.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-[#18181B] border border-[#EF4444]/60 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2 text-[#FF334F]">
              <AlertTriangle className="w-4 h-4" />
              {errorMessage}
            </span>
            <button onClick={() => setErrorMessage(null)} className="text-[#A1A1AA]">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Submission Form */}
          <div className="lg:col-span-5">
            <div className="luxury-card p-5 space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#E11D48]" /> Submit Report
              </h2>

              {submitted ? (
                <div className="p-6 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/40 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#22C55E] mx-auto" />
                  <h3 className="text-sm font-bold text-white">Report Submitted</h3>
                  <p className="text-xs text-[#A1A1AA]">Now visible on Threat Radar.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111114] border border-[#303036] text-xs text-white font-mono">
                    <MapPin className="w-4 h-4 text-[#E11D48] shrink-0" />
                    <span className="truncate">
                      {selectedCoords[0].toFixed(4)}°N, {selectedCoords[1].toFixed(4)}°E (
                      {currentDistrict ? currentDistrict.name : 'Outside TN'})
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs text-[#A1A1AA] mb-1">Issue Type</label>
                    <select
                      value={issueType}
                      onChange={e => setIssueType(e.target.value)}
                      className="w-full bg-[#111114] border border-[#303036] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                    >
                      <option value="lighting">Poor / Broken Street Lighting</option>
                      <option value="infrastructure">Road Construction / Block</option>
                      <option value="harassment">Harassment / Loitering</option>
                      <option value="stalking">Suspicious Activity</option>
                      <option value="theft">Theft Concern</option>
                      <option value="other">Other Hazard</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-[#A1A1AA] mb-1">
                      <span>Severity</span>
                      <span className="font-mono text-white">{severity}/5</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={severity}
                      onChange={e => setSeverity(parseInt(e.target.value))}
                      className="w-full accent-[#E11D48]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#A1A1AA] mb-1">Details</label>
                    <textarea
                      rows={3}
                      required
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Short description of the street or issue..."
                      className="w-full bg-[#111114] border border-[#303036] rounded-xl p-3 text-xs text-white placeholder-[#A1A1AA]/60 focus:outline-none"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#A1A1AA] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={e => setAnonymous(e.target.checked)}
                      className="accent-[#E11D48]"
                    />
                    <span>Post anonymously</span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-[#E11D48] hover:bg-[#FF334F] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Submitting...' : 'Submit Report'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Map & Recent Reports */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="h-[340px] w-full">
              <MapComponent
                center={selectedCoords}
                zoom={15}
                onMapClick={(lat, lng) => {
                  if (!isCoordinateInTamilNadu(lat, lng)) {
                    setErrorMessage('Please tap inside Tamil Nadu.');
                    return;
                  }
                  setErrorMessage(null);
                  setSelectedCoords([lat, lng]);
                }}
              />
            </div>

            <div className="luxury-card p-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#E11D48]" /> Recent Reports ({reports.length})
              </h2>
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {reports.map(rep => (
                  <div
                    key={rep.id}
                    onClick={() => setSelectedCoords([rep.lat, rep.lng])}
                    className="p-3 rounded-xl bg-[#111114] border border-[#303036] hover:border-white/25 transition-all cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B]">
                          {rep.issueType.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          {rep.areaName || 'Tamil Nadu'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#A1A1AA] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(rep.timestamp).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <p className="text-xs text-[#A1A1AA]">{rep.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
