import React from 'react';
import { X, User, Briefcase, FileText, Zap, Palette, Trash2 } from 'lucide-react';
import { CharacterPreview } from '../CharacterPreview';
import { CyberPanel, CyberButton } from '../Common/CyberUI';

interface HiringModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: any;
  setForm: (form: any) => void;
  onHire: () => void;
  isSpawning: boolean;
}

export const HiringModal = ({ isOpen, onClose, form, setForm, onHire, isSpawning }: HiringModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[2000] p-4 backdrop-blur-md">
      <CyberPanel title="NEW RECRUITMENT" idTag="RECRUIT-MODAL" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="absolute top-4 right-6">
          <button onClick={onClose} className="text-[#00f2ff] hover:rotate-90 transition-transform"><X size={32} /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-4 text-[#00f2ff]">
            <div>
              <label className="block font-black text-[10px] uppercase mb-1 opacity-60 italic">Agent Name</label>
              <input 
                type="text" 
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder="ENTER NAME"
                className="w-full p-3 bg-black/40 border-2 border-[#00f2ff]/30 font-bold focus:border-[#00f2ff] outline-none text-white"
              />
            </div>
            <div>
              <label className="block font-black text-[10px] uppercase mb-1 opacity-60 italic">Designation / Role</label>
              <input 
                type="text" 
                value={form.job}
                onChange={e => setForm({...form, job: e.target.value})}
                placeholder="e.g. SR. DEVELOPER"
                className="w-full p-3 bg-black/40 border-2 border-[#00f2ff]/30 font-bold focus:border-[#00f2ff] outline-none text-white"
              />
            </div>
            <div>
              <label className="block font-black text-[10px] uppercase mb-1 opacity-60 italic">Core Persona</label>
              <textarea 
                rows={4}
                value={form.persona}
                onChange={e => setForm({...form, persona: e.target.value})}
                placeholder="DESCRIBE AGENT PERSONALITY..."
                className="w-full p-3 bg-black/40 border-2 border-[#00f2ff]/30 font-bold focus:border-[#00f2ff] outline-none text-white resize-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative group rounded-xl overflow-hidden border-2 border-[#00f2ff]/20 bg-black/40">
              <CharacterPreview form={form} />
              <div className="absolute inset-0 pointer-events-none border border-[#00f2ff]/20 scanline-effect" />
            </div>

            <div>
              <label className="block font-black text-[10px] uppercase mb-2 text-[#00f2ff]/60 italic">Gender / Body Type</label>
              <div className="flex gap-2">
                {['male', 'female'].map(g => (
                  <button 
                    key={g}
                    onClick={() => setForm({...form, gender: g})}
                    className={`flex-1 py-2 border-2 font-bold transition-all ${form.gender === g ? 'bg-[#00f2ff] text-[#0a1120] border-[#00f2ff]' : 'bg-white/5 border-white/10 text-white/40'}`}
                  >
                    {g.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block font-black text-[10px] uppercase mb-2 text-[#00f2ff]/60 italic">Skin Tone</label>
              <div className="flex gap-2">
                {[
                  { id: 'body_light', color: '#FFE0BD' },
                  { id: 'body_tan', color: '#E0AC69' },
                  { id: 'body_dark', color: '#8D5524' }
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setForm({...form, body: t.id})}
                    className={`w-10 h-10 border-2 transition-all ${form.body === t.id ? 'border-[#00f2ff] scale-110 shadow-[0_0_10px_rgba(0,242,255,0.5)]' : 'border-black'}`}
                    style={{ backgroundColor: t.color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block font-black text-[10px] uppercase mb-2 text-[#00f2ff]/60 italic">Work Outfit</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'agent_dev', name: 'DEV' },
                  { id: 'agent_design', name: 'DESIGN' },
                  { id: 'agent_manage', name: 'MANAGE' },
                  { id: 'agent_market', name: 'MARKET' }
                ].map(o => (
                  <button 
                    key={o.id}
                    onClick={() => setForm({...form, outfit: o.id})}
                    className={`p-2 border-2 text-[10px] font-bold transition-all ${form.outfit === o.id ? 'bg-white/20 border-[#00f2ff] text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <CyberButton 
          onClick={onHire}
          disabled={isSpawning || !form.name || !form.job}
          className="w-full text-2xl mt-4"
        >
          {isSpawning ? 'RECRUITING...' : 'CONFIRM EMPLOYMENT'}
        </CyberButton>
      </CyberPanel>
    </div>
  );
};

interface ZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  setName: (name: string) => void;
  color: string;
  setColor: (color: string) => void;
  range: any;
  onAdd: () => void;
}

export const ZoneModal = ({ isOpen, onClose, name, setName, color, setColor, range, onAdd }: ZoneModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[4000] p-4 backdrop-blur-md">
      <CyberPanel title="ZONE CONFIGURATION" idTag="ZONE-SYS" className="w-full max-w-sm text-[#00f2ff]">
        
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-[#00f2ff]/60 uppercase mb-1 italic">Zone Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. MARKETING DEPT"
              autoFocus
              className="w-full p-2 bg-black/40 border-2 border-[#00f2ff]/30 font-bold focus:border-[#00f2ff] outline-none text-white"
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-[#00f2ff]/60 uppercase mb-1 italic">Identification Color</label>
            <div className="flex flex-wrap gap-2">
              {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'].map(c => (
                <button 
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 border-2 transition-transform ${color === c ? 'border-white scale-125 ring-2 ring-[#00f2ff]' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          
          <div className="p-2 bg-white/5 border border-white/10 text-[10px] text-white/40 italic">
             COORDINATES: ({range?.x1}, {range?.y1}) ~ ({range?.x2}, {range?.y2})
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border-2 border-white/20 text-white/60 font-bold hover:bg-white/5 transition-all">CANCEL</button>
          <CyberButton 
            onClick={onAdd}
            disabled={!name.trim()}
            className="flex-1 text-sm py-2"
          >
            CREATE ZONE
          </CyberButton>
        </div>
      </CyberPanel>
    </div>
  );
};

interface SaveMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  setName: (name: string) => void;
  onSave: () => void;
}

export const SaveMapModal = ({ isOpen, onClose, name, setName, onSave }: SaveMapModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[3000] p-4 backdrop-blur-md">
      <CyberPanel title="ARCHIVE BLUEPRINT" idTag="ARCHV-MAP" className="w-full max-w-md">
        
        <div>
          <label className="block font-black text-[10px] uppercase mb-2 text-[#00f2ff]/60 italic">Blueprint Name</label>
          <input 
            type="text" 
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="MY FUTURE OFFICE..."
            autoFocus
            className="w-full p-4 bg-black/40 border-2 border-[#00f2ff]/30 font-bold text-xl focus:border-[#00f2ff] outline-none text-white"
          />
        </div>

        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 border-2 border-white/20 text-white/60 font-bold text-xl hover:bg-white/5 transition-all">CANCEL</button>
          <CyberButton 
            onClick={onSave}
            disabled={!name.trim()}
            className="flex-1 text-xl py-4"
          >
            SAVE DATA
          </CyberButton>
        </div>
      </CyberPanel>
    </div>
  );
};
