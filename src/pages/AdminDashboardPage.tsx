import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Database,
  Lock,
  Layers,
  FileText,
  Clock,
  RefreshCw,
  Users,
  Search,
  MapPin,
  Map as MapIcon,
  Maximize2
} from 'lucide-react';
import { MapComponent } from '../components/MapComponent';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { SafetyReport, SafetyIncident } from '../types';

interface AdminDashboardPageProps {
  incidents?: SafetyIncident[];
  onIncidentsUpdate?: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ 
  incidents = [], 
  onIncidentsUpdate 
}) => {
  const { user, loginDemoUser } = useAuth();
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState<{ [key: string]: string }>({});
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedReportForMap, setSelectedReportForMap] = useState<SafetyReport | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'logs'>('overview');


  useEffect(() => {
    loadAdminData();
  }, [user]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [reportsRes, healthRes, analyticsRes, logsRes] = await Promise.all([
        api.getAdminReports(),
        api.getAdminHealth(),
        api.getAdminAnalytics(),
        api.getAdminAuditLogs()
      ]);
      setReports(reportsRes);
      setHealthData(healthRes);
      setAnalytics(analyticsRes);
      setAuditLogs(logsRes);
    } catch (err) {
      console.error('Admin API error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (reportId: string, status: 'verified' | 'rejected') => {
    const notes = reviewNotes[reportId] || (status === 'verified' ? 'Verified by municipal field inspector' : 'Rejected due to insufficient geographic details');
    try {
      await api.reviewReport(reportId, status, notes);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status, adminNotes: notes } : r))
      );
      
      // If verified, trigger global incident list refresh so the map updates
      if (status === 'verified' && onIncidentsUpdate) {
        onIncidentsUpdate();
      }

      // Reload logs & health
      const [logsRes, analyticsRes] = await Promise.all([
        api.getAdminAuditLogs(),
        api.getAdminAnalytics()
      ]);
      setAuditLogs(logsRes);
      setAnalytics(analyticsRes);
    } catch (err) {
      console.error(err);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="bg-[#08090b] min-h-screen flex items-center justify-center p-4">
        <div className="max-w-xl mx-auto p-8 bg-[#17181c] rounded-3xl border border-white/10 shadow-2xl text-center space-y-4 text-[#f5f5f7]">
          <div className="w-12 h-12 rounded-2xl bg-[#ffb547]/10 text-[#ffb547] border border-[#ffb547]/20 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-[#ffb547]" />
          </div>
          <h2 className="text-xl font-bold text-[#f5f5f7]">
            Administrator Privileges Required
          </h2>
          <p className="text-xs text-[#a1a1aa] leading-relaxed">
            You are currently signed in as a regular user (<strong>{user?.name || 'Guest'}</strong>). The Safety Operations Center is restricted to verified municipal safety administrators.
          </p>
          <div className="pt-2">
            <button
              onClick={() => loginDemoUser('admin')}
              className="px-5 py-2.5 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-semibold rounded-full text-xs transition shadow-lg shadow-[#0a84ff]/20 active:scale-95"
            >
              Switch to Admin Demo Account (Dr. Anita Roy)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredReports = reports.filter((r) => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  return (
    <div className="bg-[#08090b] min-h-screen text-[#f5f5f7] antialiased py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 1. Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#30d158] animate-pulse"></span>
              <h1 className="text-2xl font-bold tracking-tight text-[#f5f5f7]">
                Safety Operations Center
              </h1>
            </div>
            <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
              Logged in: <strong>{user?.name}</strong> · Role: Administrator
            </p>
          </div>

          <button
            onClick={loadAdminData}
            className="flex items-center space-x-2 px-4 py-2 bg-[#17181c] border border-white/10 hover:bg-white/10 text-[#f5f5f7] rounded-full text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#64b5ff] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync SOC Data</span>
          </button>
        </div>

        {/* 2. Tab Navigation */}
        <div className="flex items-center p-1 bg-[#17181c] rounded-2xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'overview' ? 'bg-[#0a84ff] text-white shadow-lg shadow-[#0a84ff]/20' : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Activity className="w-3.5 h-3.5" />
              <span>Platform Overview</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('moderation')}
            className={`px-6 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'moderation' ? 'bg-[#0a84ff] text-white shadow-lg shadow-[#0a84ff]/20' : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Moderation Queue</span>
              {reports.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-[#ff453a] text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {reports.filter(r => r.status === 'pending').length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'logs' ? 'bg-[#0a84ff] text-white shadow-lg shadow-[#0a84ff]/20' : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <FileText className="w-3.5 h-3.5" />
              <span>Audit Logs</span>
            </div>
          </button>
        </div>

        {/* 3. Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Health Grid */}
            {healthData && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-[#17181c] rounded-3xl border border-white/10 shadow-lg space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                    <span>Routing Engine</span>
                    <span className="w-2 h-2 rounded-full bg-[#30d158]"></span>
                  </div>
                  <div className="font-bold text-sm text-[#f5f5f7]">OSRM Operational</div>
                  <div className="text-[11px] text-[#a1a1aa]">Latency: 210ms</div>
                </div>
                <div className="p-4 bg-[#17181c] rounded-3xl border border-white/10 shadow-lg space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                    <span>Geo-Encoder</span>
                    <span className="w-2 h-2 rounded-full bg-[#30d158]"></span>
                  </div>
                  <div className="font-bold text-sm text-[#f5f5f7]">OSM Active</div>
                  <div className="text-[11px] text-[#a1a1aa]">Latency: 142ms</div>
                </div>
                <div className="p-4 bg-[#17181c] rounded-3xl border border-white/10 shadow-lg space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                    <span>Weather API</span>
                    <span className="w-2 h-2 rounded-full bg-[#30d158]"></span>
                  </div>
                  <div className="font-bold text-sm text-[#f5f5f7]">Live Sensor Grid</div>
                  <div className="text-[11px] text-[#a1a1aa]">Sync: 15m intervals</div>
                </div>
                <div className="p-4 bg-[#17181c] rounded-3xl border border-white/10 shadow-lg space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                    <span>Safety AI</span>
                    <span className="w-2 h-2 rounded-full bg-[#0a84ff]"></span>
                  </div>
                  <div className="font-bold text-sm text-[#f5f5f7]">Gemini 2.5 Flash</div>
                  <div className="text-[11px] text-[#a1a1aa]">Intelligent Path Analysis</div>
                </div>
              </div>
            )}

            {/* Analytics */}
            {analytics && (
              <div className="bg-[#17181c] rounded-3xl p-6 border border-white/10 shadow-2xl space-y-6">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-[#a1a1aa]" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Core Platform Metrics
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
                  <div>
                    <div className="text-3xl font-bold text-[#f5f5f7]">{analytics.totalUsers}</div>
                    <div className="text-[11px] text-[#a1a1aa] font-medium mt-1">Verified Residents</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-[#30d158]">{analytics.totalIncidents}</div>
                    <div className="text-[11px] text-[#a1a1aa] font-medium mt-1">Live Hazards</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-[#ffb547]">{analytics.underReviewReports}</div>
                    <div className="text-[11px] text-[#a1a1aa] font-medium mt-1">Pending Approval</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-[#64b5ff]">{analytics.verifiedReports}</div>
                    <div className="text-[11px] text-[#a1a1aa] font-medium mt-1">Community Verified</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-[#ff453a]">{analytics.totalSosTriggered}</div>
                    <div className="text-[11px] text-[#a1a1aa] font-medium mt-1">SOS Responses</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-[#f5f5f7]">{analytics.activeJourneys}</div>
                    <div className="text-[11px] text-[#a1a1aa] font-medium mt-1">Live Journeys</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'moderation' && (
          <div className="bg-[#17181c] rounded-3xl border border-white/10 shadow-2xl p-6 space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#f5f5f7]">
                  Hazard Verification & Moderation
                </h2>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Approve, reject, or inspect reported safety issues before they reach the public map.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-xs font-semibold text-[#a1a1aa]">View:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-xs bg-[#101114] border border-white/10 rounded-xl p-2.5 text-[#f5f5f7] focus:outline-hidden ring-offset-[#08090b] focus:ring-2 focus:ring-[#0a84ff]/50"
                >
                  <option value="all" className="bg-[#17181c]">All Records ({reports.length})</option>
                  <option value="pending" className="bg-[#17181c]">Pending ({reports.filter(r => r.status === 'pending').length})</option>
                  <option value="verified" className="bg-[#17181c]">Verified ({reports.filter(r => r.status === 'verified').length})</option>
                  <option value="rejected" className="bg-[#17181c]">Rejected ({reports.filter(r => r.status === 'rejected').length})</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {filteredReports.length > 0 ? (
                filteredReports.map((r) => (
                  <div
                    key={r.id}
                    className="p-5 rounded-2xl border border-white/5 bg-[#101114] hover:border-white/10 transition-colors space-y-4 shadow-sm"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-[#f5f5f7] capitalize">
                          {r.category.replace('_', ' ')}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            r.severity === 'critical' || r.severity === 'high'
                              ? 'bg-[#ff453a]/10 text-[#ff453a] border border-[#ff453a]/20'
                              : 'bg-[#ffb547]/10 text-[#ffb547] border border-[#ffb547]/20'
                          }`}
                        >
                          {r.severity}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            r.status === 'verified'
                              ? 'bg-[#30d158]/10 text-[#30d158] border border-[#30d158]/20'
                              : r.status === 'pending'
                              ? 'bg-[#ffb547]/10 text-[#ffb547] border border-[#ffb547]/20'
                              : 'bg-white/10 text-[#a1a1aa]'
                          }`}
                        >
                          {r.status}
                        </span>
                        <span className="text-[11px] text-[#a1a1aa] flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(r.submittedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => setSelectedReportForMap(r)}
                          className="flex items-center space-x-1.5 px-4 py-2 bg-[#0a84ff]/10 hover:bg-[#0a84ff]/20 text-[#64b5ff] border border-[#0a84ff]/20 rounded-xl text-xs font-semibold transition"
                        >
                          <MapIcon className="w-3.5 h-3.5" />
                          <span>Inspect Location</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Geographic Metadata</div>
                        <div className="text-xs bg-[#17181c] p-3 rounded-xl border border-white/5 space-y-1">
                          <p className="text-[#f5f5f7] font-medium">{r.locationName}</p>
                          <p className="text-[#a1a1aa] font-mono">{r.lat.toFixed(5)}, {r.lng.toFixed(5)}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Contributor Observation</div>
                        <div className="text-xs text-[#a1a1aa] leading-relaxed bg-[#17181c] p-3 rounded-xl border border-white/5 italic">
                          "{r.description}"
                        </div>
                      </div>
                    </div>

                    {r.adminNotes && (
                      <div className="text-[11px] text-[#64b5ff] bg-[#0a84ff]/10 p-3 rounded-xl border border-[#0a84ff]/20">
                        <strong>Official Resolution:</strong> {r.adminNotes}
                      </div>
                    )}

                    {r.status === 'pending' && (
                      <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 border-t border-white/5 mt-2">
                        <input
                          type="text"
                          placeholder="Internal verification notes (visible to user)..."
                          value={reviewNotes[r.id] || ''}
                          onChange={(e) =>
                            setReviewNotes({ ...reviewNotes, [r.id]: e.target.value })
                          }
                          className="w-full sm:flex-1 text-xs bg-[#17181c] border border-white/10 rounded-xl p-2.5 text-[#f5f5f7] placeholder-[#a1a1aa]/60 focus:outline-hidden focus:border-[#0a84ff]"
                        />
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleReview(r.id, 'verified')}
                            className="px-5 py-2 bg-[#30d158] hover:bg-[#28b84c] text-black font-bold rounded-full text-xs transition flex items-center space-x-1.5 shadow-lg shadow-[#30d158]/20"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 fill-black" />
                            <span>Verify & Publish</span>
                          </button>
                          <button
                            onClick={() => handleReview(r.id, 'rejected')}
                            className="px-5 py-2 bg-white/10 hover:bg-[#ff453a]/10 hover:text-[#ff453a] hover:border-[#ff453a]/20 text-[#f5f5f7] font-semibold rounded-full text-xs transition flex items-center space-x-1.5 border border-white/10"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6 text-[#a1a1aa]" />
                  </div>
                  <p className="text-xs text-[#a1a1aa] italic">
                    Queue is clear. No reports match the current filter.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-[#17181c] rounded-3xl border border-white/10 shadow-2xl p-6 space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#f5f5f7]">
                  Administrative Security Audit Trail
                </h2>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Immutable record of all moderation actions and emergency triggers.
                </p>
              </div>
              <Database className="w-5 h-5 text-[#a1a1aa]/50" />
            </div>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar text-xs">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 bg-[#101114] rounded-2xl border border-white/5 hover:border-white/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-white/5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-[#a1a1aa]" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[#64b5ff] uppercase text-[10px] tracking-wider">{log.action}</span>
                        <span className="text-white/10">|</span>
                        <span className="font-semibold text-[#f5f5f7]">{log.actorName}</span>
                      </div>
                      <div className="text-[#a1a1aa] text-[11px] mt-1 leading-relaxed">{log.details}</div>
                      <div className="text-[9px] text-[#a1a1aa]/50 mt-1 font-mono uppercase tracking-tighter">Event ID: {log.id} · Source: {log.ip}</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#a1a1aa] font-medium shrink-0 bg-white/5 px-2 py-1 rounded-md">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* 4. Location Inspection Modal/Panel */}
      {selectedReportForMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className={`bg-[#17181c] rounded-3xl border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col transition-all duration-500 ${isMapExpanded ? 'w-full h-full' : 'max-w-6xl w-full h-[85vh]'}`}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#101114]">
              <div className="flex items-center space-x-4">
                <div className="p-2.5 rounded-2xl bg-[#0a84ff]/10 text-[#0a84ff] shadow-inner">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white tracking-tight">Geographic Verification</h3>
                  <p className="text-xs text-[#a1a1aa] font-medium">{selectedReportForMap.locationName}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setIsMapExpanded(!isMapExpanded)}
                  className="p-2.5 hover:bg-white/10 rounded-full text-[#a1a1aa] hover:text-white transition-all active:scale-90"
                  title="Toggle Fullscreen"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setSelectedReportForMap(null)}
                  className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition border border-white/10 active:scale-95"
                >
                  Exit Preview
                </button>
              </div>
            </div>
            
            <div className="flex-1 relative bg-[#08090b]">
              <MapComponent 
                center={[selectedReportForMap.lat, selectedReportForMap.lng]}
                zoom={16}
                startCoords={[selectedReportForMap.lat, selectedReportForMap.lng]}
                incidents={incidents}
                showIncidents={true}
                className="w-full h-full"
              />
              
              <div className="absolute bottom-8 left-8 right-8 z-20 pointer-events-none">
                <div className="bg-[#101114]/90 backdrop-blur-2xl border border-white/15 p-6 rounded-[2rem] shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 pointer-events-auto">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                       <span className="text-[10px] font-black text-[#0a84ff] uppercase tracking-[0.2em] bg-[#0a84ff]/10 px-2 py-0.5 rounded">Active Review</span>
                       <span className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-wider">{selectedReportForMap.id}</span>
                    </div>
                    <div className="text-xl font-bold text-white capitalize">{selectedReportForMap.category.replace('_', ' ')}</div>
                    <p className="text-sm text-[#a1a1aa] line-clamp-1 max-w-2xl">User Insight: "{selectedReportForMap.description}"</p>
                  </div>
                  
                  {selectedReportForMap.status === 'pending' && (
                    <div className="flex gap-3 shrink-0">
                       <button
                        onClick={() => {
                          handleReview(selectedReportForMap.id, 'verified');
                          setSelectedReportForMap(null);
                        }}
                        className="px-8 py-3 bg-[#30d158] hover:bg-[#28b84c] text-black font-black rounded-2xl text-sm transition-all shadow-xl shadow-[#30d158]/30 active:scale-95 hover:scale-[1.02]"
                      >
                        Verify & Publish
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
