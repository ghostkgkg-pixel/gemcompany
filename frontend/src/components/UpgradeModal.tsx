import React from 'react';
import { Star } from 'lucide-react';
import { AccountService } from '../services/AccountService';
import { useGameStore } from '../store/useGameStore';

export const UpgradeModal = () => {
  const { showUpgradeModal: isOpen, setShowUpgradeModal: onClose, subscriptionPlan, setSubscriptionPlan } = useGameStore();
  
  if (!isOpen) return null;

  const onUpgrade = async (plan: string) => {
    try {
      await AccountService.upgradePlan(plan);
      setSubscriptionPlan(plan);
      onClose(false);
    } catch (err) {
      console.error("Upgrade failed:", err);
      alert("결제 처리 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="fixed inset-0 z-[30000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md cyber-panel bg-[#0a0d14] border-[#00f2ff]/30 p-8 flex flex-col gap-6 shadow-[0_0_50px_rgba(0,242,255,0.1)]">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-16 h-16 rounded-full bg-[#00f2ff]/10 flex items-center justify-center mb-2">
            <Star size={32} className="text-[#00f2ff] animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-white italic tracking-tight">UPGRADE TO PRO</h2>
          <p className="text-white/50 text-sm">슬롯 부족! 등급을 높여 더 많은 맵을 저장하세요.</p>
        </div>
        <div className="grid gap-3">
          {[
            { id: 'pro', name: 'Professional', price: '$19/mo', perks: ['24x24 Map Size', '슬롯 3개', '30 Undo Steps'] },
            { id: 'enterprise', name: 'Enterprise', price: '$49/mo', perks: ['Unlimited Size', '슬롯 5개', 'Priority Support'] }
          ].map(tier => (
            <button 
              key={tier.id}
              onClick={() => onUpgrade(tier.id)}
              className="group p-4 border border-white/10 bg-white/5 hover:border-[#00f2ff]/50 hover:bg-[#00f2ff]/5 transition-all text-left flex justify-between items-center"
            >
              <div>
                <div className="font-bold text-white group-hover:text-[#00f2ff]">{tier.name}</div>
                <div className="text-[10px] text-white/40">{tier.perks.join(' • ')}</div>
              </div>
              <div className="text-[#00f2ff] font-black italic">{tier.price}</div>
            </button>
          ))}
        </div>
        <button onClick={() => onClose(false)} className="text-white/30 text-xs hover:text-white transition-colors underline">나중에 할게요</button>
      </div>
    </div>
  );
};
