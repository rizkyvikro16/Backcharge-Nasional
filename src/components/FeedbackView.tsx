import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, Phone, MapPin, Linkedin, Github, FileText, Send, 
  MessageSquare, User, Calendar, CheckCircle2, AlertCircle, HelpCircle, ArrowRight,
  Edit, Save, X, Download, FileSpreadsheet, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ContactInquiry, Profile } from '../types';

interface FeedbackViewProps {
  inquiries: ContactInquiry[];
  currentUser: Profile | null;
  onAddInquiry: (inquiry: ContactInquiry) => void;
  onUpdateInquiry: (inquiry: ContactInquiry) => void;
  onDeleteInquiry?: (id: string) => void;
  addToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function FeedbackView({ 
  inquiries, 
  currentUser, 
  onAddInquiry, 
  onUpdateInquiry, 
  onDeleteInquiry,
  addToast 
}: FeedbackViewProps) {
  // Contact Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reply inline states
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<'Replied' | 'Under Review'>('Replied');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Contact & Professional Inquiries Editable Data
  const [contactEmail, setContactEmail] = useState(() => localStorage.getItem('bc_contact_email') || '2908.riko@gmail.com');
  const [contactPhone, setContactPhone] = useState(() => localStorage.getItem('bc_contact_phone') || '+62 88214445164');
  const [contactLocation, setContactLocation] = useState(() => localStorage.getItem('bc_contact_location') || 'Jakarta, Indonesia');
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editEmail, setEditEmail] = useState(contactEmail);
  const [editPhone, setEditPhone] = useState(contactPhone);
  const [editLocation, setEditLocation] = useState(contactLocation);

  const handleStartEditing = () => {
    setEditEmail(contactEmail);
    setEditPhone(contactPhone);
    setEditLocation(contactLocation);
    setIsEditingContact(true);
  };

  const handleSaveContactInfo = () => {
    if (!editEmail.trim() || !editPhone.trim() || !editLocation.trim()) {
      if (addToast) addToast('Harap isi semua informasi kontak sebelum menyimpan', 'error');
      return;
    }
    localStorage.setItem('bc_contact_email', editEmail.trim());
    localStorage.setItem('bc_contact_phone', editPhone.trim());
    localStorage.setItem('bc_contact_location', editLocation.trim());
    setContactEmail(editEmail.trim());
    setContactPhone(editPhone.trim());
    setContactLocation(editLocation.trim());
    setIsEditingContact(false);
    if (addToast) addToast('Informasi kontak berhasil diperbarui!', 'success');
  };

  const handleDownloadReport = () => {
    if (inquiries.length === 0) {
      if (addToast) addToast('Tidak ada data laporan untuk diunduh', 'info');
      return;
    }

    try {
      // 1. Create workbook & worksheet structure
      const wb = XLSX.utils.book_new();
      
      // 2. Prepare visual template headers and meta information
      const titleRow = ["LAPORAN MASUKAN & MAKLUMAT BALAS (FEEDBACK & BUG CMS)"];
      const subtitleRow = [`Sistem Informasi Backcharge Nasional - Dicetak Pada: ${new Date().toLocaleString()}`];
      const countRow = [`Total Laporan: ${inquiries.length} item`];
      const emptyRow = [];
      
      const tableHeaders = [
        "ID LAPORAN", 
        "NAMA PELAPOR", 
        "EMAIL", 
        "SUBJEK LAPORAN", 
        "DESKRIPSI KENDALA", 
        "STATUS", 
        "TANGGAL MASUK", 
        "TANGGAPAN FEEDBACK", 
        "DIJAWAB OLEH", 
        "WAKTU TANGGAPAN"
      ];

      // 3. Prepare data rows
      const dataRows = inquiries.map(item => [
        item.id,
        item.full_name,
        item.email,
        item.subject,
        item.message,
        item.status === 'Unread' ? 'BELUM DIBACA' : item.status === 'Under Review' ? 'DALAM REVIEW' : 'TELAH DIJAWAB',
        item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-',
        item.feedback || '-',
        item.feedback_by || '-',
        item.feedback_at ? new Date(item.feedback_at).toLocaleString('id-ID') : '-'
      ]);

      // 4. Combine into single AOA (Array of Arrays)
      const aoa = [
        titleRow,
        subtitleRow,
        countRow,
        emptyRow,
        tableHeaders,
        ...dataRows
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // 5. Define column widths for optimal reading layout (prevent ellipsis/### values)
      ws['!cols'] = [
        { wch: 15 }, // ID
        { wch: 22 }, // Nama Pelapor
        { wch: 28 }, // Email
        { wch: 25 }, // Subjek
        { wch: 45 }, // Pesan/Deskripsi
        { wch: 16 }, // Status
        { wch: 22 }, // Tanggal Masuk
        { wch: 45 }, // Feedback/Tanggapan
        { wch: 22 }, // Dijawab Oleh
        { wch: 22 }  // Waktu Tanggapan
      ];

      // 6. Save the Excel file
      XLSX.utils.book_append_sheet(wb, ws, "CMS Feedback Report");
      XLSX.writeFile(wb, `Laporan_Feedback_CMS_${new Date().toISOString().slice(0, 10)}.xlsx`);

      if (addToast) addToast('Laporan Excel (.xlsx) berhasil diunduh dengan template!', 'success');
    } catch (error) {
      console.error(error);
      if (addToast) addToast('Gagal mengunduh laporan Excel', 'error');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !message.trim()) {
      if (addToast) addToast('Harap lengkapi semua field bertanda bintang (*)', 'error');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate slight delay for professional effect
    setTimeout(() => {
      const newInquiry: ContactInquiry = {
        id: `CI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        full_name: fullName.trim(),
        email: email.trim(),
        subject: subject.trim() || 'General Inquiry',
        message: message.trim(),
        status: 'Unread',
        created_at: new Date().toISOString()
      };

      onAddInquiry(newInquiry);
      
      // Clear form
      setFullName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setIsSubmitting(false);

      if (addToast) addToast('Pesan Anda berhasil dikirim dan dicatat di database CMS!', 'success');
    }, 800);
  };

  const handleSendFeedback = (inquiry: ContactInquiry) => {
    if (!replyText.trim()) {
      if (addToast) addToast('Harap isi tanggapan feedback terlebih dahulu', 'error');
      return;
    }

    const updated: ContactInquiry = {
      ...inquiry,
      status: replyStatus,
      feedback: replyText.trim(),
      feedback_by: currentUser?.email || 'tim.terkait@company.id',
      feedback_at: new Date().toISOString()
    };

    onUpdateInquiry(updated);
    setActiveReplyId(null);
    setReplyText('');
    if (addToast) addToast(`Feedback berhasil dikirim dengan status "${replyStatus === 'Replied' ? 'Selesai / Replied' : 'Dalam Tinjauan'}"`, 'success');
  };

  const formatDateStr = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.getFullYear() + "-" + 
             ("0" + (d.getMonth() + 1)).slice(-2) + "-" + 
             ("0" + d.getDate()).slice(-2) + " " + 
             ("0" + d.getHours()).slice(-2) + ":" + 
             ("0" + d.getMinutes()).slice(-2);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* SECTION 1: HEADER & GET IN TOUCH FORM */}
      <div className="space-y-2">
        <span className="text-[10px] font-black tracking-wider text-blue-600 uppercase">GET IN TOUCH</span>
        <h2 className="text-xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Mail className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
          Kirim Masukan & Laporan Bug
        </h2>
        <p className="text-xs md:text-sm text-slate-500 max-w-3xl leading-relaxed">
          Ada kendala, bug, atau saran untuk aplikasi ini? Beritahu kami lewat formulir di bawah untuk membantu kami jadi lebih baik!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: DIRECT COMMUNICATION & PROFILES */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Direct Communication</h3>
                {currentUser?.role === 'Administrator' && !isEditingContact && (
                  <button
                    type="button"
                    onClick={handleStartEditing}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-blue-600 transition-colors flex items-center gap-1 text-[10px] font-bold"
                    title="Ubah Informasi Kontak"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Ubah</span>
                  </button>
                )}
              </div>
              
              {isEditingContact ? (
                <div className="space-y-3.5 pt-1 animate-in fade-in duration-200">
                  {/* Edit Email */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 block uppercase">Email Address</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
                    />
                  </div>

                  {/* Edit Phone */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 block uppercase">Direct Phone</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
                    />
                  </div>

                  {/* Edit Location */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 block uppercase">Primary Location</label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
                    />
                  </div>

                  {/* Save/Cancel actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingContact(false)}
                      className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-[10px] flex items-center justify-center gap-1 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Batal</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveContactInfo}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] flex items-center justify-center gap-1 transition-all shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Email */}
                  <div className="flex items-start space-x-3.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 shadow-2xs flex-shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Email Address</span>
                      <a href={`mailto:${contactEmail}`} className="text-xs font-bold text-slate-800 hover:text-blue-600 break-all">
                        {contactEmail}
                      </a>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-start space-x-3.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 shadow-2xs flex-shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Direct Phone</span>
                      <a href={`tel:${contactPhone}`} className="text-xs font-bold text-slate-800 hover:text-blue-600">
                        {contactPhone}
                      </a>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-start space-x-3.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 shadow-2xs flex-shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Primary Location</span>
                      <p className="text-xs font-bold text-slate-800">
                        {contactLocation}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: SEND DIRECT MESSAGE FORM */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="space-y-1.5 mb-6">
            <h3 className="text-lg font-extrabold text-slate-900">Send a Direct Message</h3>
            <p className="text-xs text-slate-400 font-bold">Harap isi form di bawah ini secara lengkap untuk mengajukan keluhan atau masukan.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Your Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input 
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Amar Raharja"
                    className="w-full text-xs border border-slate-200 rounded-xl pl-10 pr-4 py-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="amar.raharja@assarent.co.id"
                    className="w-full text-xs border border-slate-200 rounded-xl pl-10 pr-4 py-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                  />
                </div>
              </div>

            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Report / Feedback
              </label>
              <input 
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="misl., Tombol tidak bisa diklik di HP"
                className="w-full text-xs border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
              />
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Detailed Message <span className="text-red-500">*</span>
              </label>
              <textarea 
                rows={5}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tuliskan detail laporan Anda di sini..."
                className="w-full text-xs border border-slate-200 rounded-2xl p-4 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all resize-none"
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  <span>Mengirim Keluhan / Masukan...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Message</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>

      {/* SECTION 2: INBOUND CONTACT INQUIRIES LIST (WITH FEEDBACK MODULE) - ONLY FOR ADMINISTRATOR */}
      {currentUser?.role === 'Administrator' && (
        <div className="border border-slate-200 rounded-3xl bg-white overflow-hidden shadow-sm">
          
          {/* Section Header */}
          <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shadow-2xs">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  Inbound Contact Inquiries 
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {inquiries.length} Received
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Seluruh masukan dan laporan tersimpan dengan aman pada basis data CMS.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={handleDownloadReport}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report / Feedback</span>
              </button>
              <span className="text-[9px] text-slate-400 font-bold bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg uppercase tracking-wider">
                Recorded in CMS Database
              </span>
            </div>
          </div>

          {/* Inquiries list */}
          <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
            
            {inquiries.map((inquiry, idx) => {
              const hasReply = inquiry.status === 'Replied' || inquiry.feedback;
              return (
                <div key={inquiry.id} className={`pt-4 first:pt-0 ${idx > 0 ? 'mt-4' : ''} space-y-3`}>
                  
                  {/* Meta details & status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="w-7 h-7 bg-slate-100 text-slate-600 font-black rounded-lg flex items-center justify-center text-[10px] shadow-3xs uppercase">
                        {inquiry.full_name.charAt(0)}
                      </span>
                      <span className="text-xs font-black text-slate-800">{inquiry.full_name}</span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">({inquiry.email})</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Status badge */}
                      {inquiry.status === 'Unread' && (
                        <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 shadow-3xs">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                          Unread
                        </span>
                      )}
                      {inquiry.status === 'Under Review' && (
                        <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 shadow-3xs">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                          Under Review
                        </span>
                      )}
                      {inquiry.status === 'Replied' && (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 shadow-3xs">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          Replied
                        </span>
                      )}

                      {/* Premium 1-by-1 Deletion Trigger with Inline Confirmation */}
                      {currentUser?.role === 'Administrator' && (
                        <div className="flex items-center ml-2">
                          {confirmDeleteId === inquiry.id ? (
                            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 px-2 py-1 rounded-xl animate-in zoom-in duration-200">
                              <span className="text-[8px] font-black text-red-700 uppercase tracking-wider">Hapus?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onDeleteInquiry) {
                                    onDeleteInquiry(inquiry.id);
                                    if (addToast) addToast('Laporan keluhan berhasil dihapus permanen!', 'success');
                                  }
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white font-black text-[8px] rounded-md transition-all cursor-pointer"
                              >
                                Ya
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[8px] rounded-md transition-all cursor-pointer"
                              >
                                Tidak
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(inquiry.id)}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Laporan 1 per 1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subject & Message Content */}
                  <div className="pl-0 sm:pl-9 space-y-1.5">
                    <h4 className="text-xs font-black text-slate-900 leading-snug">
                      {inquiry.subject}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100 font-medium">
                      {inquiry.message}
                    </p>

                    <div className="flex items-center space-x-2 text-[9px] text-slate-400 font-mono pt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Received: {formatDateStr(inquiry.created_at)}</span>
                      <span className="text-slate-200">•</span>
                      <span className="text-slate-400 font-bold uppercase">{inquiry.id}</span>
                    </div>
                  </div>

                  {/* Team Feedback section */}
                  {inquiry.feedback && (
                    <div className="pl-0 sm:pl-9 mt-3">
                      <div className="bg-emerald-50 border border-emerald-100/80 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between text-[9px] font-black text-emerald-800 uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Feedback dari Tim Terkait
                          </span>
                          <span className="font-mono">
                            {formatDateStr(inquiry.feedback_at || '')}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-950 font-medium leading-relaxed italic">
                          "{inquiry.feedback}"
                        </p>
                        <div className="text-[8px] text-emerald-600 font-bold uppercase tracking-wider pt-0.5">
                          Dijawab oleh: <span className="font-mono font-black">{inquiry.feedback_by}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reply Form Trigger (Tim Terkait can respond) */}
                  {!inquiry.feedback && (
                    <div className="pl-0 sm:pl-9 pt-1 flex justify-end">
                      {activeReplyId === inquiry.id ? (
                        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-2 space-y-3 animate-in slide-in-from-top-3 duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Berikan Tanggapan Resmi</span>
                            
                            {/* Reply Status selector */}
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => setReplyStatus('Replied')}
                                className={`px-2.5 py-1 text-[9px] font-black rounded-lg transition-all ${
                                  replyStatus === 'Replied'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                Selesai / Replied
                              </button>
                              <button
                                type="button"
                                onClick={() => setReplyStatus('Under Review')}
                                className={`px-2.5 py-1 text-[9px] font-black rounded-lg transition-all ${
                                  replyStatus === 'Under Review'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                Under Review
                              </button>
                            </div>
                          </div>

                          <textarea
                            rows={2.5}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Tulis umpan balik / feedback formal kepada ${inquiry.full_name}...`}
                            className="w-full text-xs border border-slate-200 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                          />

                          <div className="flex justify-end space-x-2 text-[10px]">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveReplyId(null);
                                setReplyText('');
                              }}
                              className="px-3 py-1.5 font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendFeedback(inquiry)}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <Send className="w-3 h-3" />
                              Kirim Tanggapan
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveReplyId(inquiry.id);
                            setReplyText('');
                            setReplyStatus('Replied');
                          }}
                          className="px-3 py-1.5 border border-blue-100 hover:border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-600 font-extrabold text-[10px] rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Beri Tanggapan / Feedback
                        </button>
                      )}
                    </div>
                  )}

                </div>
              );
            })}

            {inquiries.length === 0 && (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-600">Belum Ada Inquiries Masuk</p>
                <p className="text-[10px] text-slate-400 max-w-xs mx-auto">Gunakan form di atas untuk mengirim keluhan atau saran pertama Anda.</p>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
