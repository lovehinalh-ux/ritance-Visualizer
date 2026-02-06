import React, { useState, useMemo, useEffect, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============ 類型定義 ============
type AssetType = 'cash' | 'stock' | 'property';

interface Asset {
  id: string;
  type: AssetType;
  amount: number;
  location: string;
  name?: string; // Optional custom name
}

type PersonStatusType = 'none' | 'alive' | 'deceased';

const PersonStatus: Record<string, PersonStatusType> = {
  NONE: 'none',
  ALIVE: 'alive',
  DECEASED: 'deceased'
};

interface FamilyMember {
  id: string;
  name: string;
  gender: 'male' | 'female';
  status: PersonStatusType;
  relation?: string;
  relationLabel?: string;
  hasSpouse?: boolean;
  hasChildren?: boolean;
  childCount?: number;
}

interface Heir extends FamilyMember {
  isHeir: boolean;
  share?: string;
  legalShare: number;
}

interface Family {
  self: { name: string; gender: 'male' | 'female' };
  spouse: FamilyMember;
  father: FamilyMember;
  mother: FamilyMember;
  children: FamilyMember[];
  siblings: FamilyMember[];
}

// ============ 工具函數 ============
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0
  }).format(amount);
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const formatShareRatio = (share: number) => {
  if (share <= 0) return '0';

  const tolerance = 1e-8;
  for (let denominator = 1; denominator <= 120; denominator++) {
    const numerator = Math.round(share * denominator);
    if (numerator === 0) continue;
    if (Math.abs(share - numerator / denominator) < tolerance) {
      const divisor = gcd(Math.abs(numerator), denominator);
      return `${numerator / divisor} / ${denominator / divisor}`;
    }
  }

  return `${(share * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
};

const generateId = () => Math.random().toString(36).substring(2, 9);

// ============ 稅額常數 (民國114年適用) ============
const ESTATE_TAX_EXEMPTION = 13330000;
const DEDUCTION_SPOUSE = 5530000;
const DEDUCTION_PARENT = 1380000;
const DEDUCTION_CHILD = 560000;
const DEDUCTION_FUNERAL = 1380000;

const ESTATE_TAX_BRACKETS = [
  { limit: 56210000, rate: 0.10, deduction: 0 },
  { limit: 112420000, rate: 0.15, deduction: 2810500 },
  { limit: Infinity, rate: 0.20, deduction: 8431500 },
];

const calculateInheritanceTax = (taxableAmount: number) => {
  if (taxableAmount <= 0) return { tax: 0, rate: 0 };
  const bracket = ESTATE_TAX_BRACKETS.find(b => taxableAmount <= b.limit) || ESTATE_TAX_BRACKETS[ESTATE_TAX_BRACKETS.length - 1];
  const tax = (taxableAmount * bracket.rate) - bracket.deduction;
  return {
    tax: Math.max(0, tax),
    rate: bracket.rate
  };
};

// ============ 常數定義 ============
const ASSET_TYPES: Record<AssetType, { name: string; color: string; lightColor?: string; icon: string }> = {
  cash: { name: '現金存款', color: '#10B981', icon: '💵' },
  stock: { name: '股票基金', color: '#6F86A6', lightColor: '#E9EEF4', icon: '📈' },
  property: { name: '不動產', color: '#F59E0B', icon: '🏠' },
};

const INITIAL_FAMILY: Family = {
  self: { name: '', gender: 'male' },
  spouse: { id: 'spouse', name: '配偶', gender: 'female', status: PersonStatus.NONE, hasSpouse: false, hasChildren: false },
  father: { id: 'father', name: '父', gender: 'male', status: PersonStatus.ALIVE },
  mother: { id: 'mother', name: '母', gender: 'female', status: PersonStatus.ALIVE },
  children: [],
  siblings: [],
};

// ============ 圖示元件 ============
const Icons = {
  Person: ({ gender, className }: { gender?: 'male' | 'female'; className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill={gender === 'female' ? '#EF4444' : '#3B82F6'} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ),
  User: ({ className }: { className?: string }) => <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Heart: ({ className }: { className?: string }) => <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  Users: ({ className }: { className?: string }) => <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Plus: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Trash: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Check: ({ className }: { className?: string }) => <svg className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  ArrowRight: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>,
  ArrowLeft: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>,
  ArrowUp: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>,
  ChevronDown: ({ className }: { className?: string }) => <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
};

// ============ 資產方塊元件 ============
interface AssetBlockProps {
  asset: Asset;
  onDragStart: (e: React.DragEvent, asset: Asset) => void;
  size?: 'normal' | 'small';
  showAmount?: boolean;
}

const AssetBlock: FC<AssetBlockProps> = ({ asset, onDragStart, size = 'normal', showAmount = true }) => {
  const type = ASSET_TYPES[asset.type] || ASSET_TYPES.cash;
  const blockSize = size === 'small' ? 50 : 100;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, asset)}
      className="cursor-grab active:cursor-grabbing rounded-lg flex flex-col items-center justify-center
        text-white font-medium shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl select-none"
      style={{
        backgroundColor: asset.type === 'stock' ? ASSET_TYPES.stock.lightColor : type.color,
        color: asset.type === 'stock' ? ASSET_TYPES.stock.color : 'white',
        width: `${blockSize}px`,
        height: `${blockSize}px`,
      }}
    >
      <span className="text-xl">{type.icon}</span>
      <span className="text-xs font-bold mt-1 text-center px-1 truncate max-w-full">
        {asset.name || type.name}
      </span>
      {showAmount && (
        <span className="text-[10px] mt-0.5 text-center px-1 opacity-90">
          {(asset.amount / 10000).toFixed(0)}萬
        </span>
      )}
    </div>
  );
};

// ============ 繼承人卡片元件 ============
interface HeirCardProps {
  heir: Heir;
  assets: Asset[];
  onDrop: (e: React.DragEvent, location: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, asset: Asset) => void;
  legalShare: number;
  totalEstate: number;
  isHeir: boolean;
  hasAllocationStarted: boolean;
}


const HeirCard: FC<HeirCardProps> = ({ heir, assets, onDrop, onDragOver, onDragStart, legalShare, totalEstate, isHeir, hasAllocationStarted }) => {
  // Only count assets assigned strictly to the heir (ignore extended family)
  const totalReceived = assets
    .filter(a => a.location === heir.id)
    .reduce((sum, a) => sum + a.amount, 0);
  const expectedAmount = totalEstate * legalShare;
  const reservedShare = legalShare / 2;
  const reservedShareText = formatShareRatio(reservedShare);
  const reservedAmount = expectedAmount / 2;
  const isUnderReserved = isHeir && hasAllocationStarted && totalReceived < reservedAmount;

  // 調整尺寸邏輯：父母與兄弟姊妹縮小為 6/7
  const isCompact = ['parent', 'sibling'].includes(heir.relation || '');

  const mainContent = (
    <div
      onDrop={(e) => onDrop(e, heir.id)}
      onDragOver={onDragOver}
      className={`
        relative rounded-xl transition-all duration-200
        ${isCompact ? 'p-3 min-w-[150px]' : 'p-4 min-w-[180px]'}
        ${!isHeir ? 'opacity-50 bg-gray-100 border-2 border-gray-200' :
          isUnderReserved ? 'bg-red-50 border-2 border-red-300 shadow-md' :
            'bg-white border-2 border-[#6F8F7B] shadow-md hover:shadow-lg'}
      `}
    >
      {/* 繼承人標籤 */}
      {isHeir && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6F8F7B] text-white text-xs px-2 py-0.5 rounded-full">
          繼承人
        </div>
      )}

      {/* 頭像與名稱 */}
      <div className="flex flex-col items-center mb-3">
        <div className={`rounded-full flex items-center justify-center text-2xl bg-gray-50
          ${isCompact ? 'w-10 h-10' : 'w-12 h-12'}`}>
          <Icons.Person gender={heir.gender} className={isCompact ? 'w-8 h-8' : 'w-10 h-10'} />
        </div>
        <span className="mt-2 font-semibold text-gray-700">{heir.name}</span>

      </div>

      {/* 應繼分資訊 */}
      {isHeir && (
        <div className="text-center text-sm mb-3 p-2 bg-gray-50 rounded-lg">
          <div className="text-gray-500">應繼分: <span className="font-medium text-gray-700">{heir.share}</span></div>
          <div className="text-gray-400 text-xs">約 {formatMoney(expectedAmount)}</div>
          <div className="text-amber-700 mt-1">特留分: <span className="font-medium">{reservedShareText}</span></div>
          <div className="text-amber-600 text-xs">約 {formatMoney(reservedAmount)}</div>
        </div>
      )}

      {/* 資產放置區 */}
      <div className={`
        border-2 border-dashed rounded-lg p-2 transition-colors
        ${isCompact ? 'min-h-[70px]' : 'min-h-[80px]'}
        ${isHeir ? 'border-[#6F8F7B]/30 bg-[#E9F1EC]' : 'border-gray-200 bg-gray-50'}
      `}>
        {assets.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
            {isHeir ? '拖拉資產到這裡' : '非繼承人'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 justify-center">
            <AnimatePresence>
              {assets.filter(a => a.location === heir.id).map((asset) => (
                <motion.div
                  key={asset.id}
                  layoutId={asset.id}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="relative group"
                >
                  <AssetBlock asset={asset} onDragStart={onDragStart} size="small" />
                  {/* 繼承人卡片上的資產不顯示刪除按鈕，因為只能刪除 POOL 中的資產 */}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 實際取得金額 */}
      {assets.length > 0 && (
        <div className={`mt-2 text-center text-sm font-medium ${isUnderReserved ? 'text-red-600' : 'text-[#4F7F67]'}`}>
          實得: {formatMoney(totalReceived)}
          {isUnderReserved && (
            <div className="text-xs text-red-500">⚠️ 低於特留分</div>
          )}
        </div>
      )}
    </div>
  );

  // 若為子女且有配偶或子女，使用 Side-by-Side 佈局
  if (heir.relation === 'child' && (heir.hasSpouse || heir.hasChildren)) {
    return (
      <div className="flex gap-2 items-start">
        {mainContent}

        {/* 擴充資訊區 (右側) */}
        <div className="flex flex-col gap-2 pt-2">
          {heir.hasSpouse && (
            <div
              onDrop={(e) => {
                e.stopPropagation();
                onDrop(e, `${heir.id}_spouse`);
              }}
              onDragOver={onDragOver}
              className={`flex flex-col items-center justify-center p-1 rounded-lg border-2 border-dashed bg-pink-50 w-[70px] h-[70px] transition-colors
                ${assets.filter(a => a.location === `${heir.id}_spouse`).length > 0 ? 'border-pink-300' : 'border-pink-200'}
              `}
            >
              <div className="text-xs text-pink-500 font-bold mb-1 scale-90">配偶</div>
              <div className="flex flex-wrap gap-0.5 justify-center overflow-hidden w-full h-full">
                {assets.filter(a => a.location === `${heir.id}_spouse`).map(asset => (
                  <div key={asset.id} className="scale-75 origin-center">
                    <AssetBlock asset={asset} onDragStart={onDragStart} size="small" showAmount={false} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {heir.hasChildren && (
            <div className="flex flex-col gap-1">
              {Array.from({ length: Math.max(1, heir.childCount || 1) }).map((_, index) => (
                <div
                  key={index}
                  onDrop={(e) => {
                    e.stopPropagation();
                    onDrop(e, `${heir.id}_child_${index}`);
                  }}
                  onDragOver={onDragOver}
                  className={`flex flex-col items-center justify-center p-1 rounded-lg border-2 border-dashed bg-blue-50 w-[70px] min-h-[70px] transition-colors
                    ${assets.filter(a => a.location === `${heir.id}_child_${index}`).length > 0 ? 'border-blue-300' : 'border-blue-200'}
                  `}
                >
                  <div className="text-xs text-blue-500 font-bold mb-1 scale-90">孫子女 {index + 1}</div>
                  <div className="flex flex-wrap gap-0.5 justify-center overflow-hidden w-full h-full">
                    {assets.filter(a => a.location === `${heir.id}_child_${index}`).map(asset => (
                      <div key={asset.id} className="scale-75 origin-center">
                        <AssetBlock asset={asset} onDragStart={onDragStart} size="small" showAmount={false} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return mainContent;
};

// ============ 稅務面板元件 ============
interface EstateTaxPanelProps {
  totalEstate: number;
  family: Family;
  onCalculatedChange?: (total: number, tax: number) => void;
}

const EstateTaxPanel: FC<EstateTaxPanelProps> = ({ totalEstate, family: initialFamily, onCalculatedChange }) => {
  const [isExpanded, setIsExpanded] = useState(true); // Default expanded for usability

  // Local Calculator States (Manual Overrides)
  // const [localAssets, setLocalAssets] = useState<string>('');
  const [localSpouse, setLocalSpouse] = useState<boolean>(initialFamily.spouse.status === PersonStatus.ALIVE);
  const [localChildren, setLocalChildren] = useState<number>(initialFamily.children.filter(c => c.status === PersonStatus.ALIVE).length);
  const [localParents, setLocalParents] = useState<number>((initialFamily.father.status === PersonStatus.ALIVE ? 1 : 0) + (initialFamily.mother.status === PersonStatus.ALIVE ? 1 : 0));
  const [localOther, setLocalOther] = useState<string>('');

  // Rename and update functionality: "清除數字" instead of sync
  // const handleClearClick = () => {
  //   setLocalAssets('');
  //   setLocalOther('');
  //   setLocalSpouse(initialFamily.spouse.status === PersonStatus.ALIVE);
  //   setLocalChildren(initialFamily.children.filter(c => c.status === PersonStatus.ALIVE).length);
  //   setLocalParents((initialFamily.father.status === PersonStatus.ALIVE ? 1 : 0) + (initialFamily.mother.status === PersonStatus.ALIVE ? 1 : 0));
  // };

  // 1. Calculate Active Values
  // const activeAssets = localAssets !== '' ? (parseFloat(localAssets) || 0) * 10000 : totalEstate;
  // User Request: Force sync with totalEstate
  const activeAssets = totalEstate;
  const activeOther = (parseFloat(localOther) || 0) * 10000;

  // 2. Calculate Deductions
  const deductions = useMemo(() => {
    interface DeductionItem { label: string; amount: number; fixed?: boolean }
    const items: DeductionItem[] = [
      { label: '免稅額', amount: ESTATE_TAX_EXEMPTION, fixed: true },
      { label: '喪葬費 (標準)', amount: DEDUCTION_FUNERAL, fixed: true },
    ];

    if (localSpouse) items.push({ label: '配偶扣除額', amount: DEDUCTION_SPOUSE });
    if (localParents > 0) items.push({ label: `父母扣除額(${localParents}位)`, amount: DEDUCTION_PARENT * localParents });
    if (localChildren > 0) items.push({ label: `卑親屬扣除額(${localChildren}位)`, amount: DEDUCTION_CHILD * localChildren });
    if (activeOther > 0) items.push({ label: '其他扣除額', amount: activeOther });

    return items;
  }, [localSpouse, localParents, localChildren, activeOther]);

  const totalDeduction = deductions.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);
  const taxableAmount = Math.max(0, activeAssets - totalDeduction);
  const { tax, rate } = calculateInheritanceTax(taxableAmount);

  // Sync back to parent for main UI summary
  useEffect(() => {
    if (onCalculatedChange) {
      onCalculatedChange(activeAssets, tax);
    }
  }, [activeAssets, tax, onCalculatedChange]);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-[#F3E5D8] overflow-hidden mb-6">
      <div className="bg-[#4A3B32] p-4 text-white flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <div className="bg-[#D38B3F] p-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </div>
          <div>
            <h2 className="font-bold text-lg">遺產稅試算工具 (試算盤)</h2>
            <p className="text-xs text-amber-200">可手動調整數字進行試算，不影響下方分配</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm opacity-80">預估遺產稅</div>
          <div className="text-xl font-bold text-amber-400">{formatMoney(tax)}</div>
        </div>
      </div>

      <div className={`transition-all duration-300 ${isExpanded ? 'max-h-[1500px] border-t' : 'max-h-0'} overflow-hidden`}>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* 左側：輸入區 */}
            <div className="lg:col-span-7 space-y-6">
              <section>
                <div className="flex justify-between items-end mb-2">
                  <h3 className="text-sm font-bold text-[#4A3B32]">1. 遺產總額</h3>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={Math.round(totalEstate / 10000)}
                    disabled
                    className="w-full p-3 border border-[#E5D5C5] bg-gray-100 text-xl font-bold text-gray-500 rounded-xl cursor-not-allowed"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">萬元</span>
                </div>
                <div className="mt-2 text-xs text-amber-600 font-medium">
                  * 遺產總額已鎖定，自動加總下方「資產池」與「繼承人」持有的所有資產。
                </div>
              </section>

              <section className="bg-[#FFFCF9] border border-[#F3E5D8] rounded-xl p-4">
                <h3 className="text-sm font-bold text-[#4A3B32] mb-3">2. 扣除額快速調整</h3>
                <div className="space-y-3">
                  {/* 配偶 */}
                  <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-200">
                    <span className="text-sm text-gray-600">配偶</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={localSpouse} onChange={e => setLocalSpouse(e.target.checked)} className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D38B3F]"></div>
                    </label>
                  </div>
                  {/* 子女 */}
                  <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-200">
                    <span className="text-sm text-gray-600">卑親屬 (子女)</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setLocalChildren(Math.max(0, localChildren - 1))} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600">-</button>
                      <span className="w-4 text-center font-bold text-sm">{localChildren}</span>
                      <button onClick={() => setLocalChildren(localChildren + 1)} className="w-6 h-6 rounded-full bg-amber-100 text-[#D38B3F]">+</button>
                    </div>
                  </div>
                  {/* 父母 */}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-600">父母</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setLocalParents(Math.max(0, localParents - 1))} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600">-</button>
                      <span className="w-4 text-center font-bold text-sm">{localParents}</span>
                      <button onClick={() => setLocalParents(Math.min(2, localParents + 1))} className="w-6 h-6 rounded-full bg-amber-100 text-[#D38B3F]">+</button>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <label className="text-xs font-bold text-gray-400 mb-1 block">其他扣除額 (萬元)</label>
                <input
                  type="number"
                  value={localOther}
                  onChange={e => setLocalOther(e.target.value)}
                  placeholder="債務、稅款等..."
                  className="w-full p-2 border border-[#E5D5C5] bg-[#FFFCF9] rounded-lg text-sm outline-none"
                />
              </section>
            </div>

            {/* 右側：結果摘要 */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#856E56] text-white rounded-xl p-5 shadow-inner">
                <h3 className="text-xs font-bold opacity-60 uppercase mb-4 tracking-widest text-center">計算結果</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="opacity-70">遺產總額</span>
                    <span className="font-mono">{formatMoney(activeAssets)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-400">
                    <span className="opacity-70">扣除總計</span>
                    <span className="font-mono">-{formatMoney(totalDeduction)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between">
                    <span className="font-bold">應稅遺產</span>
                    <span className="font-mono text-lg text-amber-400">{formatMoney(taxableAmount)}</span>
                  </div>
                  <div className="mt-4 bg-white/5 rounded-lg p-3 text-center border border-white/10">
                    <div className="text-xs opacity-50 mb-1">預估遺產稅率 {(rate * 100).toFixed(0)}%</div>
                    <div className="text-3xl font-black text-amber-500">{formatMoney(tax)}</div>
                  </div>
                </div>
              </div>

              {/* 小級距表 */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <table className="w-full text-[10px] text-left">
                  <thead>
                    <tr className="text-gray-400 border-b">
                      <th className="pb-1">應稅淨額</th>
                      <th className="pb-1">稅率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ESTATE_TAX_BRACKETS.map((b, i) => (
                      <tr key={i} className={taxableAmount <= b.limit && (i === 0 || taxableAmount > ESTATE_TAX_BRACKETS[i - 1].limit) ? 'text-[#D38B3F] font-bold' : 'text-gray-400'}>
                        <td className="py-1">{b.limit === Infinity ? '1.12億以上' : `${b.limit / 100000000} 億以下`}</td>
                        <td className="py-1">{(b.rate * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#FFFCF9] border-t px-4 py-2 flex justify-center">
        <button onClick={() => setIsExpanded(!isExpanded)} className="text-[#D38B3F] text-xs font-bold flex items-center gap-1 hover:underline">
          {isExpanded ? '收合面板 ▲' : '展開完整試算工具 ▼'}
        </button>
      </div>
    </div>
  );
};

// ============ 主元件 ============
export default function InheritanceVisualizer() {
  const [step, setStep] = useState<'FAMILY' | 'ASSETS'>('FAMILY');
  const [family, setFamily] = useState<Family>(INITIAL_FAMILY);
  // Start with empty assets
  const [assets, setAssets] = useState<Asset[]>([]);
  const [draggedAsset, setDraggedAsset] = useState<Asset | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingType, setPendingType] = useState<AssetType>('cash');
  const [pendingAmount, setPendingAmount] = useState<string>('');
  const [pendingName, setPendingName] = useState<string>('');

  // States to sync from the tax calculator
  const [calcTotal, setCalcTotal] = useState<number>(0);
  const [calcTax, setCalcTax] = useState<number>(0);

  // Pool Visibility State
  const [isPoolExpanded, setIsPoolExpanded] = useState(true);

  // ============ 家庭資料處理 ============
  const updateSpouse = (hasSpouse: boolean) => {
    setFamily(prev => ({
      ...prev,
      spouse: { ...prev.spouse, status: hasSpouse ? PersonStatus.ALIVE : PersonStatus.NONE }
    }));
  };

  const updateParent = (role: 'father' | 'mother', status: PersonStatusType) => {
    setFamily(prev => ({ ...prev, [role]: { ...prev[role as keyof Family], status } }));
  };

  const addChild = () => {
    const newChild: FamilyMember = {
      id: generateId(),
      name: `子女 ${family.children.length + 1} `,
      gender: 'male',
      status: PersonStatus.ALIVE,
    };
    setFamily(prev => ({ ...prev, children: [...prev.children, newChild] }));
  };

  const removeChild = (id: string) => {
    setFamily(prev => ({ ...prev, children: prev.children.filter(c => c.id !== id) }));
    // 移除分配給這個子女的資產
    setAssets(prev => prev.map(a => a.location === id ? { ...a, location: 'pool' } : a));
  };

  const updateChildName = (id: string, name: string) => {
    setFamily(prev => ({
      ...prev,
      children: prev.children.map(c => c.id === id ? { ...c, name } : c)
    }));
  };

  const updateChildGender = (id: string, gender: 'male' | 'female') => {
    setFamily(prev => ({
      ...prev,
      children: prev.children.map(c => c.id === id ? { ...c, gender } : c)
    }));
  };

  const updateChildMeta = (id: string, field: 'hasSpouse' | 'hasChildren', value: boolean) => {
    setFamily(prev => ({
      ...prev,
      children: prev.children.map(c => c.id === id ? {
        ...c,
        [field]: value,
        // Reset or initialize childCount when hasChildren is toggled
        childCount: field === 'hasChildren' && value ? 1 : (field === 'hasChildren' && !value ? 0 : c.childCount)
      } : c)
    }));
  };

  const updateChildCount = (id: string, count: number) => {
    setFamily(prev => ({
      ...prev,
      children: prev.children.map(c => c.id === id ? { ...c, childCount: Math.max(0, count) } : c)
    }));
  };

  const addSibling = () => {
    const newSibling: FamilyMember = {
      id: generateId(),
      name: `兄弟姊妹 ${family.siblings.length + 1}`,
      gender: 'male',
      status: PersonStatus.ALIVE,
    };
    setFamily(prev => ({ ...prev, siblings: [...prev.siblings, newSibling] }));
  };

  const removeSibling = (id: string) => {
    setFamily(prev => ({ ...prev, siblings: prev.siblings.filter(s => s.id !== id) }));
    setAssets(prev => prev.map(a => a.location === id ? { ...a, location: 'pool' } : a));
  };

  const updateSiblingName = (id: string, name: string) => {
    setFamily(prev => ({
      ...prev,
      siblings: prev.siblings.map(s => s.id === id ? { ...s, name } : s)
    }));
  };

  const updateSiblingGender = (id: string, gender: 'male' | 'female') => {
    setFamily(prev => ({
      ...prev,
      siblings: prev.siblings.map(s => s.id === id ? { ...s, gender } : s)
    }));
  };

  // ============ 計算繼承人 ============
  const heirs = useMemo<Heir[]>(() => {
    // 加入所有在輸入頁中「存在」的人 (包含非繼承人)
    const allCandidates: (FamilyMember & { relation: Heir['relation'], relationLabel: string })[] = [];

    // 依序加入配偶、父母、子女
    if (family.spouse.status !== PersonStatus.NONE) {
      allCandidates.push({ ...family.spouse, relation: 'spouse', relationLabel: '配偶' });
    }
    if (family.father.status !== PersonStatus.NONE) {
      allCandidates.push({ ...family.father, relation: 'parent', relationLabel: '父親' });
    }
    if (family.mother.status !== PersonStatus.NONE) {
      allCandidates.push({ ...family.mother, relation: 'parent', relationLabel: '母親' });
    }
    family.children.forEach(c => {
      allCandidates.push({ ...c, relation: 'child', relationLabel: '子女' });
    });
    family.siblings.forEach(s => {
      allCandidates.push({ ...s, relation: 'sibling', relationLabel: '兄弟姊妹' });
    });

    // 定義合法繼承人判斷基準
    const livingChildren = family.children.filter(c => c.status === PersonStatus.ALIVE);
    const hasSpouse = family.spouse.status === PersonStatus.ALIVE;
    const hasFather = family.father.status === PersonStatus.ALIVE;
    const hasMother = family.mother.status === PersonStatus.ALIVE;
    const livingSiblings = family.siblings.filter(s => s.status === PersonStatus.ALIVE);

    return allCandidates.map(person => {
      let isHeir = false;
      let share = '0';
      let legalShare = 0;

      // 法律繼承順位邏輯
      if (livingChildren.length > 0) {
        // 第一順位：直系血親卑親屬
        if ((person.relation === 'child' && person.status === PersonStatus.ALIVE) || (person.relation === 'spouse' && hasSpouse)) {
          isHeir = true;
          const totalHeirs = livingChildren.length + (hasSpouse ? 1 : 0);
          share = `1 / ${totalHeirs}`;
          legalShare = 1 / totalHeirs;
        }
      } else if (hasFather || hasMother) {
        // 第二順位：父母
        if ((person.relation === 'parent' && person.status === PersonStatus.ALIVE) || (person.relation === 'spouse' && hasSpouse)) {
          isHeir = true;
          const parentCount = (hasFather ? 1 : 0) + (hasMother ? 1 : 0);
          if (person.relation === 'spouse') {
            share = '1/2';
            legalShare = 0.5;
          } else {
            legalShare = hasSpouse ? 0.5 / parentCount : 1 / parentCount;
            share = hasSpouse ? (parentCount === 1 ? '1/2' : '1/4') : (parentCount === 1 ? '1/1' : '1/2');
          }
        }
      } else if (livingSiblings.length > 0) {
        // 第三順位：兄弟姊妹
        if ((person.relation === 'sibling' && person.status === PersonStatus.ALIVE) || (person.relation === 'spouse' && hasSpouse)) {
          isHeir = true;
          const sibCount = livingSiblings.length;
          if (person.relation === 'spouse') {
            share = '1/2';
            legalShare = 0.5;
          } else {
            legalShare = hasSpouse ? 0.5 / sibCount : 1 / sibCount;
            share = hasSpouse ? `1/${sibCount * 2}` : `1/${sibCount}`;
          }
        }
      } else if (hasSpouse && person.relation === 'spouse') {
        isHeir = true;
        share = '1/1';
        legalShare = 1;
      }

      return { ...person, isHeir, share, legalShare };
    });
  }, [family]);

  // ============ 資產處理 ============
  const totalEstate = assets.reduce((sum: number, a: Asset) => sum + a.amount, 0);

  // 計算總扣除額 (用於主畫面快速計算)
  const autoDeductionAmount = useMemo(() => {
    let total = ESTATE_TAX_EXEMPTION + DEDUCTION_FUNERAL;
    if (family.spouse.status === PersonStatus.ALIVE) total += DEDUCTION_SPOUSE;
    const parentCount = (family.father.status === PersonStatus.ALIVE ? 1 : 0) + (family.mother.status === PersonStatus.ALIVE ? 1 : 0);
    total += parentCount * DEDUCTION_PARENT;
    const childCount = family.children.filter(c => c.status === PersonStatus.ALIVE).length;
    total += childCount * DEDUCTION_CHILD;
    return total;
  }, [family]);

  const { tax } = calculateInheritanceTax(Math.max(0, totalEstate - autoDeductionAmount));
  const afterTaxEstate = totalEstate - tax;

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    setDraggedAsset(asset);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetLocation: string) => {
    e.preventDefault();
    if (!draggedAsset) return;

    // 分配邏輯：可分配給繼承池或任何在清覽表中的人
    // 支援：
    // 1. Pool -> Heir (原功能)
    // 2. Heir -> Heir (新功能 - 只要 targetLocation 是另一個繼承人)
    // 3. Heir -> Pool (新功能 - targetLocation === 'pool')

    // 如果目標是 drop zone (例如子女的配偶/小孩區)，ID 會是 childId_spouse 或 childId_children_${index}
    const targetHeir = heirs.find(h => h.id === targetLocation);
    // 支援：childId_spouse, childId_children, childId_child_0, childId_child_1 ...
    const isExtendedZone = targetLocation.endsWith('_spouse') || targetLocation.includes('_child_');

    if (!targetHeir && targetLocation !== 'pool' && !isExtendedZone) return;

    setAssets(prev => prev.map(a =>
      a.id === draggedAsset.id ? { ...a, location: targetLocation } : a
    ));
    setDraggedAsset(null);
    setDraggedAsset(null);
  };

  const handleResetAllocation = () => {
    if (confirm('確定要收回所有資產回到資產池嗎？')) {
      setAssets(prev => prev.map(a => ({ ...a, location: 'pool' })));
    }
  };


  const handleDeleteAsset = (assetId: string) => {
    // 僅允許在 pool 內的資產被刪除 (UI 層面已做防堵，這裡做雙重確認)
    const asset = assets.find(a => a.id === assetId);
    if (asset?.location !== 'pool') return;

    if (confirm('確定要刪除此資產嗎？')) {
      setAssets(prev => prev.filter(a => a.id !== assetId));
    }
  };

  // Open Modal
  const handleAddAssetClick = (type: AssetType) => {
    setPendingType(type);
    setPendingAmount(''); // Reset
    setPendingName('');   // Reset
    setIsModalOpen(true);
  };

  // Confirm Add (from Modal)
  const handleConfirmAdd = () => {
    const amountVal = parseInt(pendingAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('請輸入有效金額');
      return;
    }

    const newAsset: Asset = {
      id: generateId(),
      type: pendingType,
      amount: amountVal * 10000, // Convert Wan to Unit
      location: 'pool',
      name: pendingName.trim() || undefined
    };

    setAssets(prev => {
      const updated = [...prev, newAsset];
      return updated.sort((a, b) => {
        const typeOrder = Object.keys(ASSET_TYPES);
        const typeDiff = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
        if (typeDiff !== 0) return typeDiff;
        return b.amount - a.amount;
      });
    });
    setIsModalOpen(false);
  };

  const handleAssetAmountChange = (assetId: string, newAmount: number) => {
    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, amount: Math.max(0, newAmount) } : a));
  };

  const poolAssets = assets.filter(a => a.location === 'pool');

  // ============ 渲染 ============
  return (
    <div className="min-h-screen bg-[#FAF9F7] font-[sans-serif] flex flex-col items-center">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 w-full sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
          <div className="flex-grow">
            <h1 className="text-xl md:text-2xl font-bold text-[#4A3B32]">Mr. Three 保險工具箱 | 遺產分配模擬器</h1>
            <p className="text-xs md:text-sm text-[#8C7B70] hidden sm:block">輕鬆勾選，一鍵生成您的家族繼承關係與資產分配</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
              ${step === 'FAMILY' ? 'bg-[#D38B3F] text-white' : 'bg-[#E5D5C5] text-[#8C7B70]'}`}>
              1. 建立家庭
            </div>
            <Icons.ArrowRight />
            <div className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
              ${step === 'ASSETS' ? 'bg-[#D38B3F] text-white' : 'bg-[#E5D5C5] text-[#8C7B70]'}`}>
              2. 分配資產
            </div>
          </div>
        </div>
      </header>

      <main className={`w-full mx-auto px-6 py-8 pb-[500px] ${step === 'FAMILY' ? 'max-w-3xl' : 'max-w-6xl'} flex flex-col gap-6`}>
        {step === 'FAMILY' ? (
          /* ============ Step 1: 家庭資料輸入 ============ */
          <div className="space-y-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-[#4A3B32] mb-4">您是否也面臨繼承分配的困擾？</h2>
              <p className="text-[#8C7B70]">釐清問題，是解決問題的第一步。請依序填寫以下資訊。</p>
            </div>

            {/* 被繼承人 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#F3E5D8]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#FFF4E0] rounded-full flex items-center justify-center text-[#D97706]">
                  <Icons.User />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[#4A3B32] mb-2">1. 關於您 (被繼承人)</h3>
                  <p className="text-sm text-gray-500 mb-4">假設您是這份繼承表的規劃者</p>
                  <label className="block text-sm font-medium text-gray-700 mb-1">您的姓名</label>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={family.self.name}
                      onChange={(e) => setFamily(prev => ({ ...prev, self: { ...prev.self, name: e.target.value } }))}
                      placeholder="請輸入姓名"
                      className="flex-1 p-3 border border-[#E5D5C5] bg-[#FFFCF9] text-[#4A3B32] placeholder-[#B0A8A0] rounded-lg focus:ring-2 focus:ring-[#D97706] focus:border-transparent outline-none transition-all"
                    />
                    <div className="flex bg-[#FFFCF9] border border-[#E5D5C5] rounded-lg overflow-hidden p-1 gap-1">
                      <button
                        onClick={() => setFamily(prev => ({ ...prev, self: { ...prev.self, gender: 'male' } }))}
                        className={`px-3 rounded-md transition-colors ${family.self.gender === 'male' ? 'bg-[#3B82F6] text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                      >
                        男
                      </button>
                      <button
                        onClick={() => setFamily(prev => ({ ...prev, self: { ...prev.self, gender: 'female' } }))}
                        className={`px-3 rounded-md transition-colors ${family.self.gender === 'female' ? 'bg-[#EF4444] text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                      >
                        女
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 配偶 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#F3E5D8]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#FFF4E0] rounded-full flex items-center justify-center text-[#D97706]">
                  <Icons.Heart />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[#4A3B32] mb-2">2. 配偶狀況</h3>
                  <p className="text-sm text-gray-500 mb-4">是否有合法的婚姻關係？</p>

                  <div className="flex gap-4">
                    <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${family.spouse.status === PersonStatus.ALIVE ? 'border-[#D38B3F] bg-[#FFF9F2]' : 'border-[#E5D5C5] bg-[#FFFCF9] hover:border-[#D1C4B9]'}`}>
                      <input
                        type="radio"
                        name="spouse"
                        className="hidden"
                        checked={family.spouse.status === PersonStatus.ALIVE}
                        onChange={() => updateSpouse(true)}
                      />
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-[#4A3B32]">有配偶</span>
                      </div>
                    </label>

                    <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${family.spouse.status === PersonStatus.NONE ? 'border-[#D38B3F] bg-[#FFF9F2]' : 'border-[#E5D5C5] bg-[#FFFCF9] hover:border-[#D1C4B9]'}`}>
                      <input
                        type="radio"
                        name="spouse"
                        className="hidden"
                        checked={family.spouse.status === PersonStatus.NONE}
                        onChange={() => updateSpouse(false)}
                      />
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-[#4A3B32]">無配偶</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 父母 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#F3E5D8]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#FFF4E0] rounded-full flex items-center justify-center text-[#D97706]">
                  <Icons.Users />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[#4A3B32] mb-2">3. 父母狀況</h3>
                  <p className="text-sm text-gray-500 mb-4">您的父母目前是否健在？</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['father', 'mother'] as const).map((role) => (
                      <div key={role}>
                        <p className="font-semibold mb-2 text-[#4A3B32]">{role === 'father' ? '父親' : '母親'}</p>
                        <select
                          value={family[role].status}
                          onChange={(e) => updateParent(role, e.target.value as PersonStatusType)}
                          className="w-full p-3 border border-[#E5D5C5] bg-[#FFFCF9] text-[#4A3B32] rounded-lg focus:ring-2 focus:ring-[#D97706] outline-none"
                        >
                          <option value={PersonStatus.NONE}>不詳/歿</option>
                          <option value={PersonStatus.ALIVE}>健在</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 子女 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#F3E5D8]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#FFF4E0] rounded-full flex items-center justify-center text-[#D97706]">
                  <Icons.Users />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[#4A3B32] mb-1">4. 子女狀況</h3>
                      <p className="text-sm text-gray-500">增加您的子女 (包含養子女)</p>
                    </div>
                    <button
                      onClick={addChild}
                      className="flex items-center space-x-2 bg-[#D38B3F] text-white px-4 py-2 rounded-lg hover:bg-[#B97A37] transition-colors shadow-sm"
                    >
                      <Icons.Plus />
                      <span>新增子女</span>
                    </button>
                  </div>

                  {family.children.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-[#E5D5C5] text-gray-400">
                      目前沒有新增子女資料
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {family.children.map((child, idx) => (
                        <div key={child.id} className="p-4 border border-[#E5D5C5] bg-[#FFFCF9] rounded-xl space-y-3">
                          <div className="flex items-center gap-3">
                            <span className="text-[#4A3B32] font-mono font-bold w-6 bg-[#E5D5C5] rounded-full h-6 flex items-center justify-center text-xs">{idx + 1}</span>
                            <label className="text-sm font-bold text-[#4A3B32] min-w-10">姓名:</label>
                            <input
                              type="text"
                              value={child.name}
                              onChange={(e) => updateChildName(child.id, e.target.value)}
                              placeholder="子女姓名"
                              className="flex-1 p-2 border border-[#E5D5C5] bg-white text-[#4A3B32] rounded-md focus:ring-2 focus:ring-[#16A34A] outline-none"
                            />
                            <div className="flex bg-white border border-[#E5D5C5] rounded-md overflow-hidden p-0.5 gap-0.5">
                              <button
                                onClick={() => updateChildGender(child.id, 'male')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${child.gender === 'male' ? 'bg-[#3B82F6] text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                              >
                                男
                              </button>
                              <button
                                onClick={() => updateChildGender(child.id, 'female')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${child.gender === 'female' ? 'bg-[#EF4444] text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                              >
                                女
                              </button>
                            </div>
                            <button
                              onClick={() => removeChild(child.id)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                              title="刪除此子女"
                            >
                              <Icons.Trash />
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-4 pl-9">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <div
                                onClick={() => updateChildMeta(child.id, 'hasSpouse', !child.hasSpouse)}
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${child.hasSpouse ? 'bg-[#D38B3F] border-[#D38B3F]' : 'bg-white border-[#E5D5C5] group-hover:border-[#D38B3F]'}`}
                              >
                                {child.hasSpouse && <Icons.Check className="text-white w-3 h-3" />}
                              </div>
                              <span className="text-sm text-[#4A3B32]">是否有配偶</span>
                            </label>

                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 cursor-pointer group">
                                <div
                                  onClick={() => updateChildMeta(child.id, 'hasChildren', !child.hasChildren)}
                                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${child.hasChildren ? 'bg-[#D38B3F] border-[#D38B3F]' : 'bg-white border-[#E5D5C5] group-hover:border-[#D38B3F]'}`}
                                >
                                  {child.hasChildren && <Icons.Check className="text-white w-3 h-3" />}
                                </div>
                                <span className="text-sm text-[#4A3B32]">是否有子女</span>
                              </label>

                              {child.hasChildren && (
                                <div className="flex items-center gap-2 ml-1 bg-amber-50 rounded-lg px-2 py-1 border border-amber-100">
                                  <span className="text-xs text-gray-500">人數:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={child.childCount || 1}
                                    onChange={(e) => updateChildCount(child.id, parseInt(e.target.value))}
                                    className="w-12 p-0.5 border border-[#E5D5C5] rounded text-sm text-center focus:ring-1 focus:ring-[#D38B3F] outline-none bg-white"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 兄弟姊妹 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-[#F3E5D8]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#FFF4E0] rounded-full flex items-center justify-center text-[#D97706]">
                  <Icons.Users />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[#4A3B32] mb-1">5. 兄弟姊妹狀況</h3>
                      <p className="text-sm text-gray-500">若無第 1, 2 順位繼承人，此為第 3 順位</p>
                    </div>
                    <button
                      onClick={addSibling}
                      className="flex items-center space-x-2 bg-[#D38B3F] text-white px-4 py-2 rounded-lg hover:bg-[#B97A37] transition-colors shadow-sm"
                    >
                      <Icons.Plus />
                      <span>新增兄弟姊妹</span>
                    </button>
                  </div>

                  {family.siblings.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-[#E5D5C5] text-gray-400">
                      目前沒有新增兄弟姊妹資料
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {family.siblings.map((sib, idx) => (
                        <div key={sib.id} className="p-4 border border-[#E5D5C5] bg-[#FFFCF9] rounded-xl">
                          <div className="flex items-center gap-3">
                            <span className="text-[#4A3B32] font-mono font-bold w-6 bg-[#E5D5C5] rounded-full h-6 flex items-center justify-center text-xs">{idx + 1}</span>
                            <label className="text-sm font-bold text-[#4A3B32] min-w-10">姓名:</label>
                            <input
                              type="text"
                              value={sib.name}
                              onChange={(e) => updateSiblingName(sib.id, e.target.value)}
                              placeholder="姓名"
                              className="flex-1 p-2 border border-[#E5D5C5] bg-white text-[#4A3B32] rounded-md focus:ring-2 focus:ring-[#D38B3F] outline-none"
                            />
                            <div className="flex bg-white border border-[#E5D5C5] rounded-md overflow-hidden p-0.5 gap-0.5">
                              <button
                                onClick={() => updateSiblingGender(sib.id, 'male')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${sib.gender === 'male' ? 'bg-[#3B82F6] text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                              >
                                男
                              </button>
                              <button
                                onClick={() => updateSiblingGender(sib.id, 'female')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${sib.gender === 'female' ? 'bg-[#EF4444] text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                              >
                                女
                              </button>
                            </div>
                            <button
                              onClick={() => removeSibling(sib.id)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                              title="刪除"
                            >
                              <Icons.Trash />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 下一步按鈕 */}
            <div className="sticky bottom-4">
              <button
                onClick={() => setStep('ASSETS')}
                className="w-full bg-[#4A3B32] text-[#FFF9F2] text-xl font-bold py-4 rounded-xl shadow-xl hover:bg-[#3D3028] transform active:scale-[0.99] transition-all flex justify-center items-center gap-2"
              >
                <Icons.Check />
                下一步：分配資產
              </button>
            </div>
          </div>
        ) : (
          /* ============ Step 2: 資產分配 ============ */
          (() => {
            // Check if allocation has started (any asset moved out of pool)
            const hasAllocationStarted = assets.some(a => a.location !== 'pool');

            return (
              <div className="space-y-6">
                {/* 返回按鈕 */}
                <button
                  onClick={() => setStep('FAMILY')}
                  className="flex items-center gap-2 text-amber-700 hover:text-amber-900 transition-colors"
                >
                  <Icons.ArrowLeft />
                  <span>返回修改家庭資料</span>
                </button>

                {/* 稅務試算工具 (EstateMap 整合) */}
                <EstateTaxPanel
                  totalEstate={totalEstate}
                  family={family}
                  onCalculatedChange={(total, tax) => {
                    setCalcTotal(total);
                    setCalcTax(tax);
                  }}
                />

                {/* 總覽卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
                    <div className="text-sm text-muted mb-1">遺產總額</div>
                    <div className="text-2xl font-bold text-secondary">{formatMoney(calcTotal || totalEstate)}</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100">
                    <div className="text-sm text-gray-500 mb-1">遺產稅（估算）</div>
                    <div className="text-2xl font-bold text-red-500">-{formatMoney(calcTax)}</div>
                  </div>
                </div>

                {/* 繼承系統表 + 資產分配 */}
                {/* 繼承系統表 + 資產分配 */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
                  <div className="text-center mb-6">
                    <h2 className="text-lg font-bold text-secondary mb-2">👨👩👧👦 繼承系統表</h2>
                    <p className="text-sm text-muted">綠框為有繼承權者，將下方資產拖拉到繼承人卡片上進行分配</p>
                  </div>

                  {/* 父母要在被繼承人的上方 */}
                  <div className="flex flex-col items-center">
                    {/* 第一層：父母 */}
                    <div className="flex flex-wrap justify-center gap-4 mb-2">
                      {heirs.filter(h => h.relation === 'parent').map((heir) => (
                        <HeirCard
                          key={heir.id}
                          heir={heir}
                          assets={assets.filter(a => a.location === heir.id)}
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onDragStart={handleDragStart}
                          legalShare={heir.legalShare}
                          totalEstate={afterTaxEstate}
                          isHeir={heir.isHeir}
                          hasAllocationStarted={hasAllocationStarted}
                        />
                      ))}
                    </div>

                    {/* 連接線 (父母到自己) */}
                    {heirs.some(h => h.relation === 'parent') && (
                      <div className="w-0.5 h-6 bg-gray-300 mb-2"></div>
                    )}

                    {/* 第二層：兄弟姊妹 (左) - 被繼承人 (中) - 配偶 (右) */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-16 items-start w-full mb-6 relative px-4">

                      {/* 左側：兄弟姊妹 (若有) */}
                      <div className="flex justify-end h-full">
                        {heirs.some(h => h.relation === 'sibling') && (
                          <div className="flex flex-col items-end gap-2 relative mt-4">
                            {/* 連接線到被繼承人 (gap-16 is 64px) */}
                            <div className="absolute right-[-64px] top-[100px] w-16 h-0.5 bg-gray-300"></div>

                            <div className="flex flex-wrap justify-end gap-4 max-w-[400px]">
                              {heirs.filter(h => h.relation === 'sibling').map((heir) => (
                                <HeirCard
                                  key={heir.id}
                                  heir={heir}
                                  assets={assets.filter(a => a.location === heir.id)}
                                  onDrop={handleDrop}
                                  onDragOver={handleDragOver}
                                  onDragStart={handleDragStart}
                                  legalShare={heir.legalShare}
                                  totalEstate={afterTaxEstate}
                                  isHeir={heir.isHeir}
                                  hasAllocationStarted={hasAllocationStarted}
                                />
                              ))}
                            </div>
                            {!heirs.some(h => h.relation === 'child') && !heirs.some(h => h.relation === 'parent') && (
                              <div className="text-xs text-muted italic pr-2">啟動第 3 順位</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 中間：被繼承人 (Anchor) */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="bg-[#FBF2E6] border-2 border-[#D9A15B] rounded-xl p-4 text-center min-w-[180px] min-h-[220px] shadow-sm flex flex-col items-center">
                          <div className="mb-4 flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-white shadow-inner mb-3">
                              <Icons.Person gender={family.self.gender} className="w-10 h-10" />
                            </div>
                            <div className="font-bold text-[#4A3B32] text-lg mb-1">{family.self.name}</div>
                            <div className="text-xs text-[#D9A15B] font-bold px-2 py-0.5 bg-white rounded-full inline-block border border-[#D9A15B]/20">被繼承人</div>
                          </div>

                          {/* Placeholder to match HeirCard's Asset Area height */}
                          <div className="flex-1 w-full mt-2 border-2 border-dashed border-[#D9A15B]/20 rounded-lg bg-white/50 flex flex-col items-center justify-center p-2">
                            <div className="text-[10px] text-[#D9A15B]/60 font-medium">遺產總額</div>
                            <div className="text-xs font-bold text-[#4A3B32]">{formatMoney(totalEstate)}</div>
                          </div>
                        </div>
                      </div>

                      {/* 右側：配偶 (若有) */}
                      <div className="flex justify-start h-full">
                        {heirs.some(h => h.relation === 'spouse') && (
                          <div className="relative mt-4">
                            {/* 連接線到被繼承人 (gap-16 is 64px) */}
                            <div className="absolute left-[-64px] top-[100px] w-16 h-0.5 bg-gray-300"></div>

                            {heirs.filter(h => h.relation === 'spouse').map((heir) => (
                              <HeirCard
                                key={heir.id}
                                heir={heir}
                                assets={assets.filter(a => a.location === heir.id)}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragStart={handleDragStart}
                                legalShare={heir.legalShare}
                                totalEstate={afterTaxEstate}
                                isHeir={heir.isHeir}
                                hasAllocationStarted={hasAllocationStarted}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 向下連接線 (給子女) */}
                    {heirs.some(h => h.relation === 'child') && (
                      <div className="flex flex-col items-center w-full -mt-6 mb-2">
                        <div className="w-0.5 h-12 bg-gray-300"></div>
                      </div>
                    )}

                    {/* 第三層：子女 */}
                    {heirs.some(h => h.relation === 'child') && (
                      <div className="flex flex-wrap justify-center gap-4 mb-8">
                        {heirs.filter(h => h.relation === 'child').map((heir) => (
                          <HeirCard
                            key={heir.id}
                            heir={heir}
                            assets={assets.filter(a =>
                              a.location === heir.id ||
                              a.location === `${heir.id}_spouse` ||
                              a.location.includes(`${heir.id}_child_`)
                            )}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragStart={handleDragStart}
                            legalShare={heir.legalShare}
                            totalEstate={afterTaxEstate}
                            isHeir={heir.isHeir}
                            hasAllocationStarted={hasAllocationStarted}
                          />
                        ))}
                      </div>
                    )}

                    {heirs.length === 0 && (
                      <div className="text-gray-400 py-8">請先設定家庭成員</div>
                    )}
                  </div>
                </div>

                {/* 資產池 (Floating Bottom) */}
                {/* 資產池 (Floating Island V2) */}
                <div className={`
              fixed z-50 transition-all duration-300 ease-in-out
              ${isPoolExpanded
                    ? 'bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl rounded-2xl shadow-2xl border border-amber-200 bg-[#FFFCF9]/95 backdrop-blur-md p-4'
                    : 'bottom-4 right-4 w-auto rounded-full shadow-lg bg-white border border-gray-200 hover:shadow-xl'
                  }
            `}>
                  {!isPoolExpanded ? (
                    // Minimized View
                    <button
                      onClick={() => setIsPoolExpanded(true)}
                      className="flex items-center gap-2 px-4 py-3 text-[#4A3B32] font-bold hover:bg-gray-50 rounded-full transition-colors"
                    >
                      <span className="text-xl">📦</span>
                      <span>資產池 ({assets.filter(a => a.location === 'pool').length})</span>
                      <Icons.ArrowUp className="w-4 h-4 ml-1" />
                    </button>
                  ) : (
                    // Expanded View
                    <div className="w-full">
                      <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
                        <div className="text-center md:text-left flex items-center gap-4">
                          <div>
                            <h2 className="text-lg font-bold text-secondary">📦 資產池</h2>
                            <p className="text-xs text-muted">點擊按鈕新增資產</p>
                          </div>
                          <button
                            onClick={handleResetAllocation}
                            className="px-3 py-1.5 bg-[#EF4444] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1 shadow-sm"
                          >
                            <span>↺</span> 重新分配
                          </button>
                          <button
                            onClick={() => setIsPoolExpanded(false)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors ml-2"
                            title="縮小視窗"
                          >
                            <Icons.ChevronDown className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                          {(Object.entries(ASSET_TYPES) as [AssetType, { name: string; color: string; icon: string }][]).map(([key, type]) => (
                            <button
                              key={key}
                              onClick={() => handleAddAssetClick(key)}
                              className="px-3 py-1.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
                              style={{ backgroundColor: type.color }}
                            >
                              {type.icon} +
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Add Asset Modal */}
                      {isModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
                            <h3 className="text-xl font-bold text-[#4A3B32] mb-4 flex items-center gap-2">
                              <span className="text-2xl">{(ASSET_TYPES[pendingType] || ASSET_TYPES.cash).icon}</span>
                              新增{(ASSET_TYPES[pendingType] || ASSET_TYPES.cash).name}
                            </h3>

                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  金額 (萬元) <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={pendingAmount}
                                  onChange={(e) => setPendingAmount(e.target.value)}
                                  placeholder="例如：500 (代表500萬)"
                                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D38B3F] focus:border-transparent text-lg"
                                  autoFocus
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  項目名稱 (選填)
                                </label>
                                <input
                                  type="text"
                                  value={pendingName}
                                  onChange={(e) => setPendingName(e.target.value)}
                                  placeholder={`例如：${pendingType === 'property' ? '台北大安區公寓' : '台積電股票'} `}
                                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D38B3F] focus:border-transparent"
                                />
                                <p className="text-xs text-gray-400 mt-1">若不填寫將顯示預設名稱</p>
                              </div>

                              <div className="flex gap-3 mt-6">
                                <button
                                  onClick={() => setIsModalOpen(false)}
                                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                  取消
                                </button>
                                <button
                                  onClick={handleConfirmAdd}
                                  className="flex-1 py-3 px-4 bg-[#D38B3F] text-white font-bold rounded-xl hover:bg-[#B97A37] transition-colors"
                                >
                                  確認新增
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div
                        onDrop={(e) => handleDrop(e, 'pool')}
                        onDragOver={handleDragOver}
                        className="min-h-[120px] border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50"
                      >
                        <div className="flex flex-wrap gap-3">
                          <AnimatePresence>
                            {assets.filter(a => a.location === 'pool')
                              .sort((a, b) => {
                                const typeOrder = Object.keys(ASSET_TYPES);
                                const typeDiff = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
                                if (typeDiff !== 0) return typeDiff;
                                return b.amount - a.amount;
                              })
                              .map((asset) => (
                                <motion.div
                                  key={asset.id}
                                  layoutId={asset.id}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                  className="relative group"
                                >
                                  <AssetBlock asset={asset} onDragStart={handleDragStart} />
                                  <button
                                    onClick={() => handleDeleteAsset(asset.id)}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full
                          opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none flex items-center justify-center pb-0.5"
                                  >
                                    ×
                                  </button>
                                  <input
                                    type="number"
                                    value={asset.amount / 10000}
                                    onChange={(e) => handleAssetAmountChange(asset.id, (parseInt(e.target.value) || 0) * 10000)}
                                    className="absolute -bottom-7 left-0 right-0 text-xs text-center bg-white border rounded px-1 py-0.5
                          opacity-0 group-hover:opacity-100 transition-opacity w-full"
                                    step={10}
                                  />
                                </motion.div>
                              ))}
                          </AnimatePresence>
                          {poolAssets.length === 0 && (
                            <div className="w-full text-center text-gray-400 py-4">
                              所有資產已分配完畢 ✨
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 圖例 */}
                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                        {Object.entries(ASSET_TYPES).map(([key, type]) => (
                          <div key={key} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: type.color }} />
                            <span>{type.icon} {type.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>


                {/* 說明 */}
                <div className="bg-border/30 rounded-xl p-6 border border-border">
                  <h3 className="font-bold text-secondary mb-3">📚 使用說明</h3>
                  <ul className="text-sm text-secondary space-y-1.5">
                    <li>• <strong>拖拉分配</strong>：將資產方塊從資產池拖到繼承人卡片</li>
                    <li>• <strong>調整金額</strong>：滑鼠移到方塊上可修改金額</li>
                    <li>• <strong>新增資產</strong>：點擊資產池右上角的按鈕</li>
                    <li>• <strong>特留分警告</strong>：低於特留分時卡片會變紅</li>
                  </ul>
                  <div className="mt-4 p-3 bg-white/50 rounded-lg text-sm text-primary">
                    💡 本工具僅供參考，實際遺產規劃請諮詢專業顧問
                  </div>
                </div>
              </div >
            );
          })()
        )
        }
      </main >
    </div >
  );
}
