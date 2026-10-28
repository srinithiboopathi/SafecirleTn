import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Phone,
  Mail,
  Shield,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Send,
  HeartHandshake,
  MessageCircle,
  Star
} from 'lucide-react';
import { api } from '../services/api';
import { TrustedContact } from '../types';
import {
  buildTelUrl,
  formatPhoneForWhatsApp,
  getDefaultWhatsAppContactId,
  initiateImmediatePhoneCall,
  setDefaultWhatsAppContactId
} from '../utils/whatsappUtils';

export const TrustedContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [defaultContactId, setDefaultContactId] = useState<string | null>(getDefaultWhatsAppContactId());
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('Parent');
  const [receiveSos, setReceiveSos] = useState(true);
  const [receiveJourney, setReceiveJourney] = useState(true);
  const [makeDefaultWhatsApp, setMakeDefaultWhatsApp] = useState(true);

  const [simSuccessMsg, setSimSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const data = await api.getContacts();
      setContacts(data);
      const defId = getDefaultWhatsAppContactId();
      if (defId && data.some((c) => c.id === defId)) {
        setDefaultContactId(defId);
      } else if (data.length > 0) {
        setDefaultContactId(data[0].id);
        setDefaultWhatsAppContactId(data[0].id);
      } else {
        setShowAddForm(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    try {
      if (editingId) {
        const updated = await api.updateContact(editingId, {
          name,
          phone,
          email,
          relationship,
          receiveSos,
          receiveJourney
        });
        if (makeDefaultWhatsApp) {
          setDefaultContactId(updated.id);
          setDefaultWhatsAppContactId(updated.id);
        }
      } else {
        const created = await api.addContact({
          name,
          phone,
          email,
          relationship,
          receiveSos,
          receiveJourney
        });
        if (makeDefaultWhatsApp || contacts.length === 0) {
          setDefaultContactId(created.id);
          setDefaultWhatsAppContactId(created.id);
        }
      }
      resetForm();
      loadContacts();
      setSimSuccessMsg(`Saved contact "${name}" (${phone}) for real WhatsApp & SOS sharing.`);
      setTimeout(() => setSimSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to save contact:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteContact(id);
      setContacts(contacts.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (c: TrustedContact) => {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email || '');
    setRelationship(c.relationship || 'Friend');
    setReceiveSos(c.receiveSos);
    setReceiveJourney(c.receiveJourney);
    setShowAddForm(true);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setRelationship('Parent');
    setReceiveSos(true);
    setReceiveJourney(true);
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleSetDefaultContact = (c: TrustedContact) => {
    setDefaultContactId(c.id);
    setDefaultWhatsAppContactId(c.id);
    setSimSuccessMsg(`${c.name} (${c.phone}) is now your Default WhatsApp Contact for live trip sharing.`);
    setTimeout(() => setSimSuccessMsg(null), 4000);
  };

  return (
    <div className="bg-[#08090b] min-h-screen text-[#f5f5f7] antialiased py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center space-x-2">
              <HeartHandshake className="w-6 h-6 text-[#64b5ff]" />
              <h1 className="text-2xl font-bold tracking-tight text-[#f5f5f7]">
                Trusted Emergency Circle
              </h1>
            </div>
            <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
              Pre-authorize family and trusted friends to receive instant GPS relays during emergencies and journey sharing.
            </p>
          </div>

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center space-x-2 bg-[#0a84ff] hover:bg-[#0077ed] text-white font-semibold px-4 py-2.5 rounded-full text-xs transition shadow-lg shadow-[#0a84ff]/20 active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Trusted Contact</span>
            </button>
          )}
        </div>

        {simSuccessMsg && (
          <div className="bg-[#30d158]/10 border border-[#30d158]/20 text-[#30d158] p-3.5 rounded-2xl text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#30d158]" />
            <span>{simSuccessMsg}</span>
          </div>
        )}

        {/* Add / Edit Form Modal/Card */}
        {showAddForm && (
          <form
            onSubmit={handleSaveContact}
            className="bg-[#17181c] rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4"
          >
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#f5f5f7]">
              {editingId ? 'Edit Contact Details' : 'Add New Trusted Contact'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sunita Sharma (Mother)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs bg-[#101114] border border-white/10 rounded-xl p-2.5 text-[#f5f5f7] placeholder-[#a1a1aa]/60 focus:outline-hidden focus:border-[#0a84ff]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                  Mobile Phone (SMS & Voice) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g., +91 98765 43211"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs bg-[#101114] border border-white/10 rounded-xl p-2.5 text-[#f5f5f7] placeholder-[#a1a1aa]/60 focus:outline-hidden focus:border-[#0a84ff]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g., contact@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs bg-[#101114] border border-white/10 rounded-xl p-2.5 text-[#f5f5f7] placeholder-[#a1a1aa]/60 focus:outline-hidden focus:border-[#0a84ff]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#a1a1aa] block mb-1">
                  Relationship
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full text-xs bg-[#101114] border border-white/10 rounded-xl p-2.5 text-[#f5f5f7] focus:outline-hidden"
                >
                  <option value="Parent" className="bg-[#17181c]">Parent / Guardian</option>
                  <option value="Sibling" className="bg-[#17181c]">Sibling</option>
                  <option value="Partner" className="bg-[#17181c]">Spouse / Partner</option>
                  <option value="Friend" className="bg-[#17181c]">Friend / Roommate</option>
                  <option value="Colleague" className="bg-[#17181c]">Work Colleague</option>
                </select>
              </div>
            </div>

            {/* Preferences Checkboxes */}
            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row gap-4">
              <label className="flex items-center space-x-2 text-xs font-medium text-[#f5f5f7] cursor-pointer">
                <input
                  type="checkbox"
                  checked={receiveSos}
                  onChange={(e) => setReceiveSos(e.target.checked)}
                  className="rounded border-white/20 bg-[#101114] text-[#0a84ff] focus:ring-[#0a84ff] w-4 h-4"
                />
                <span>Receive Emergency SOS Alerts & Live GPS</span>
              </label>

              <label className="flex items-center space-x-2 text-xs font-medium text-[#f5f5f7] cursor-pointer">
                <input
                  type="checkbox"
                  checked={receiveJourney}
                  onChange={(e) => setReceiveJourney(e.target.checked)}
                  className="rounded border-white/20 bg-[#101114] text-[#0a84ff] focus:ring-[#0a84ff] w-4 h-4"
                />
                <span>Receive Journey Sharing Updates & ETA</span>
              </label>

              <label className="flex items-center space-x-2 text-xs font-medium text-[#25D366] cursor-pointer">
                <input
                  type="checkbox"
                  checked={makeDefaultWhatsApp}
                  onChange={(e) => setMakeDefaultWhatsApp(e.target.checked)}
                  className="rounded border-white/20 bg-[#101114] text-[#25D366] focus:ring-[#25D366] w-4 h-4"
                />
                <span>Set as Default WhatsApp Contact</span>
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-[#f5f5f7] text-xs font-semibold rounded-full border border-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#0a84ff] hover:bg-[#0077ed] text-white text-xs font-semibold rounded-full shadow-md"
              >
                {editingId ? 'Update Contact' : 'Save Contact'}
              </button>
            </div>
          </form>
        )}

        {/* Contacts List */}
        <div className="space-y-3">
          {contacts.length === 0 && !loading ? (
            <div className="bg-[#17181c] rounded-3xl p-8 border border-white/10 text-center space-y-3">
              <Users className="w-8 h-8 text-[#64b5ff] mx-auto" />
              <h3 className="text-sm font-bold text-white">No Contacts Saved Yet</h3>
              <p className="text-xs text-[#a1a1aa] max-w-md mx-auto">
                Save your real family or trusted friend's name and WhatsApp mobile number above so you can share your live trip and real-time GPS location directly with them.
              </p>
            </div>
          ) : null}

          {contacts.map((c) => {
            const isDefault = c.id === defaultContactId;
            const waPhone = formatPhoneForWhatsApp(c.phone);
            const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
              `Hi ${c.name}, I have added you as my Trusted Emergency & Live Trip Contact on SafeCircle.`
            )}`;

            return (
              <div
                key={c.id}
                className={`bg-[#17181c] rounded-3xl p-5 border shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                  isDefault ? 'border-[#25D366]/50' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#0a84ff]/10 text-[#64b5ff] border border-[#0a84ff]/20 flex items-center justify-center font-bold text-sm shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#f5f5f7] text-sm">{c.name}</span>
                      <span className="text-[10px] bg-white/5 text-[#a1a1aa] px-2.5 py-0.5 rounded-full font-medium border border-white/5">
                        {c.relationship}
                      </span>
                      {isDefault && (
                        <span className="text-[10px] bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Star className="w-3 h-3 fill-[#25D366]" />
                          Default WhatsApp
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#a1a1aa]">
                      <span className="flex items-center space-x-1 font-mono">
                        <Phone className="w-3.5 h-3.5 text-[#a1a1aa]" />
                        <span>{c.phone}</span>
                      </span>
                      {c.email && (
                        <span className="flex items-center space-x-1">
                          <Mail className="w-3.5 h-3.5 text-[#a1a1aa]" />
                          <span>{c.email}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      {c.receiveSos && (
                        <span className="text-[10px] font-semibold text-[#ff453a] bg-[#ff453a]/10 border border-[#ff453a]/20 px-2 py-0.5 rounded-full">
                          SOS Active
                        </span>
                      )}
                      {c.receiveJourney && (
                        <span className="text-[10px] font-semibold text-[#30d158] bg-[#30d158]/10 border border-[#30d158]/20 px-2 py-0.5 rounded-full">
                          Journey Updates Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-black font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
                    title={`Open WhatsApp chat with ${c.name}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-black" />
                    <span>WhatsApp</span>
                  </a>

                  {!isDefault && (
                    <button
                      onClick={() => handleSetDefaultContact(c)}
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-[#a1a1aa] hover:text-[#25D366] border border-white/10 font-semibold text-xs rounded-xl transition flex items-center space-x-1"
                      title="Set as Default WhatsApp Contact"
                    >
                      <Star className="w-3 h-3" />
                      <span>Set Default</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleEdit(c)}
                    className="p-2 text-[#a1a1aa] hover:text-[#f5f5f7] hover:bg-white/10 rounded-xl transition"
                    title="Edit contact"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-2 text-[#ff453a]/80 hover:text-[#ff453a] hover:bg-[#ff453a]/10 rounded-xl transition"
                    title="Remove contact"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-[#17181c] p-4 rounded-2xl border border-white/10 text-xs text-[#a1a1aa] flex items-start space-x-2.5">
          <Shield className="w-4 h-4 text-[#64b5ff] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-[#f5f5f7]">Privacy & Security Guarantee:</strong> Contact details are stored securely and never accessible by third parties. Contacts only receive notifications during verified user-initiated journeys or Emergency SOS events.
          </p>
        </div>
      </div>
    </div>
  );
};
