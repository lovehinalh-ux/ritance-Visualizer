import React, { useState, useMemo, type FC } from 'react';

// ============ 類型定義 ============
type AssetType = 'cash' | 'stock' | 'property' | 'insurance';

interface Asset {
  id: string;
  type: AssetType;
  amount: number;
  location: string;
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
  status: PersonStatusType;
  relation?: string;
  relationLabel?: string;
}

interface Heir extends FamilyMember {
  isHeir: boolean;
  share?: string;
  legalShare: number;
}

interface Family {
  self: { name: string };
  spouse: FamilyMember;
  father: FamilyMember;
  mother: FamilyMember;
  children: FamilyMember[];
  siblings: unknown[];
}

// ============ 工具函數 ============
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0
  }).format(amount);
};

const generateId = () => Math.random().toString(36).substring(2, 9);

// 遺產稅計算（台灣 2024 年級距）
const calculateInheritanceTax = (taxableAmount: number) => {
  const exemption = 13330000; // 免稅額
  const deductions = 5530000; // 基本扣除額
  const netAmount = Math.max(0, taxableAmount - exemption - deductions);

  if (netAmount <= 0) return 0;
  if (netAmount <= 50000000) return netAmount * 0.1;
  if (netAmount <= 100000000) return 5000000 + (netAmount - 50000000) * 0.15;
  return 12500000 + (netAmount - 100000000) * 0.2;
};

// ============ 常數定義 ============
const ASSET_TYPES: Record<AssetType, { name: string; color: string; icon: string }> = {
  cash: { name: '現金存款', color: '#10B981', icon: '💵' },
  stock: { name: '股票基金', color: '#3B82F6', icon: '📈' },
  property: { name: '不動產', color: '#F59E0B', icon: '🏠' },
  insurance: { name: '保險給付', color: '#8B5CF6', icon: '🛡️' },
};

const INITIAL_FAMILY: Family = {
  self: { name: '被繼承人' },
  spouse: { id: 'spouse', name: '配偶', status: PersonStatus.NONE },
  father: { id: 'father', name: '父', status: PersonStatus.ALIVE },
  mother: { id: 'mother', name: '母', status: PersonStatus.ALIVE },
  children: [],
  siblings: [],
};

// ============ 圖示元件 ============
const Icons = {
  User: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Heart: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  Users: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Check: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  ArrowRight: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>,
  ArrowLeft: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>,
};

// ============ 資產方塊元件 ============
interface AssetBlockProps {
  asset: Asset;
  onDragStart: (e: React.DragEvent, asset: Asset) => void;
  size?: 'normal' | 'small';
  showAmount?: boolean;
}

const AssetBlock: FC<AssetBlockProps> = ({ asset, onDragStart, size = 'normal', showAmount = true }) => {
  const type = ASSET_TYPES[asset.type];
  const blockSize = size === 'small' ? 50 : Math.max(60, Math.min(100, Math.sqrt(asset.amount / 100000) * 18));

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, asset)}
      className="cursor-grab active:cursor-grabbing rounded-lg flex flex-col items-center justify-center
        text-white font-medium shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl select-none"
      style={{
        backgroundColor: type.color,
        width: `${blockSize}px`,
        height: `${blockSize}px`,
      }}
    >
      <span className="text-xl">{type.icon}</span>
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
  onRemoveAsset: (heirId: string, assetId: string) => void;
  legalShare: number;
  totalEstate: number;
  isHeir: boolean;
}

const HeirCard: FC<HeirCardProps> = ({ heir, assets, onDrop, onDragOver, onRemoveAsset, legalShare, totalEstate, isHeir }) => {
  const totalReceived = assets.reduce((sum, a) => sum + a.amount, 0);
  const expectedAmount = totalEstate * legalShare;
  const reservedAmount = expectedAmount / 2;
  const isUnderReserved = isHeir && totalReceived < reservedAmount && totalReceived > 0;

  return (
    <div
      onDrop={(e) => onDrop(e, heir.id)}
      onDragOver={onDragOver}
      className={`
        relative rounded-xl p-4 transition-all duration-200 min-w-[180px]
        ${!isHeir ? 'opacity-50 bg-gray-100 border-2 border-gray-200' :
          isUnderReserved ? 'bg-red-50 border-2 border-red-300 shadow-md' :
            'bg-white border-2 border-green-300 shadow-md hover:shadow-lg'}
      `}
    >
      {/* 繼承人標籤 */}
      {isHeir && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
          繼承人
        </div>
      )}

      {/* 頭像與名稱 */}
      <div className="flex flex-col items-center mb-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl
          ${isHeir ? 'bg-green-100' : 'bg-gray-200'}`}>
          {heir.relation === 'spouse' ? '💑' :
            heir.relation === 'child' ? '👶' :
              heir.relation === 'parent' ? '👴' : '👤'}
        </div>
        <span className="mt-2 font-semibold text-gray-700">{heir.name}</span>
        <span className="text-xs text-gray-400">{heir.relationLabel}</span>
      </div>

      {/* 應繼分資訊 */}
      {isHeir && (
        <div className="text-center text-sm mb-3 p-2 bg-gray-50 rounded-lg">
          <div className="text-gray-500">應繼分: <span className="font-medium text-gray-700">{heir.share}</span></div>
          <div className="text-gray-400 text-xs">約 {formatMoney(expectedAmount)}</div>
        </div>
      )}

      {/* 資產放置區 */}
      <div className={`
        min-h-[80px] border-2 border-dashed rounded-lg p-2 transition-colors
        ${isHeir ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50'}
      `}>
        {assets.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
            {isHeir ? '拖拉資產到這裡' : '非繼承人'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 justify-center">
            {assets.map((asset) => (
              <div key={asset.id} className="relative group">
                <AssetBlock asset={asset} onDragStart={() => { }} size="small" />
                <button
                  onClick={() => onRemoveAsset(heir.id, asset.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full
                    opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 實際取得金額 */}
      {assets.length > 0 && (
        <div className={`mt-2 text-center text-sm font-medium
          ${isUnderReserved ? 'text-red-600' : 'text-green-600'}`}>
          實得: {formatMoney(totalReceived)}
          {isUnderReserved && (
            <div className="text-xs text-red-500">⚠️ 低於特留分</div>
          )}
        </div>
      )}
    </div>
  );
};

// ============ 主元件 ============
export default function InheritanceVisualizer() {
  const [step, setStep] = useState<'FAMILY' | 'ASSETS'>('FAMILY');
  const [family, setFamily] = useState<Family>(INITIAL_FAMILY);
  const [assets, setAssets] = useState<Asset[]>([
    { id: 'cash1', type: 'cash', amount: 5000000, location: 'pool' },
    { id: 'stock1', type: 'stock', amount: 8000000, location: 'pool' },
    { id: 'property1', type: 'property', amount: 20000000, location: 'pool' },
  ]);
  const [draggedAsset, setDraggedAsset] = useState<Asset | null>(null);

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
      name: `子女 ${family.children.length + 1}`,
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

  // ============ 計算繼承人 ============
  const heirs = useMemo<Heir[]>(() => {
    const result: Heir[] = [];
    const hasSpouse = family.spouse.status === PersonStatus.ALIVE;
    const livingChildren = family.children.filter(c => c.status === PersonStatus.ALIVE);
    const hasFather = family.father.status === PersonStatus.ALIVE;
    const hasMother = family.mother.status === PersonStatus.ALIVE;

    // 第一順位：子女
    if (livingChildren.length > 0) {
      const totalHeirs = livingChildren.length + (hasSpouse ? 1 : 0);
      const share = `1/${totalHeirs}`;

      if (hasSpouse) {
        result.push({
          ...family.spouse,
          relation: 'spouse',
          relationLabel: '配偶',
          isHeir: true,
          share,
          legalShare: 1 / totalHeirs,
        });
      }

      livingChildren.forEach((child) => {
        result.push({
          ...child,
          relation: 'child',
          relationLabel: '子女',
          isHeir: true,
          share,
          legalShare: 1 / totalHeirs,
        });
      });
    }
    // 第二順位：父母
    else if (hasFather || hasMother) {
      if (hasSpouse) {
        result.push({
          ...family.spouse,
          relation: 'spouse',
          relationLabel: '配偶',
          isHeir: true,
          share: '1/2',
          legalShare: 0.5,
        });
      }

      const parentCount = (hasFather ? 1 : 0) + (hasMother ? 1 : 0);
      const parentShare = hasSpouse ? 0.5 / parentCount : 1 / parentCount;
      const parentShareStr = hasSpouse
        ? (parentCount === 1 ? '1/2' : '1/4')
        : (parentCount === 1 ? '1/1' : '1/2');

      if (hasFather) {
        result.push({
          ...family.father,
          relation: 'parent',
          relationLabel: '父親',
          isHeir: true,
          share: parentShareStr,
          legalShare: parentShare,
        });
      }
      if (hasMother) {
        result.push({
          ...family.mother,
          relation: 'parent',
          relationLabel: '母親',
          isHeir: true,
          share: parentShareStr,
          legalShare: parentShare,
        });
      }
    }
    // 只有配偶
    else if (hasSpouse) {
      result.push({
        ...family.spouse,
        relation: 'spouse',
        relationLabel: '配偶',
        isHeir: true,
        share: '1/1',
        legalShare: 1,
      });
    }

    // 加入非繼承人（用於顯示）
    if (!hasSpouse && family.spouse.status !== PersonStatus.NONE) {
      result.push({ ...family.spouse, relation: 'spouse', relationLabel: '配偶', isHeir: false, legalShare: 0 });
    }

    return result;
  }, [family]);

  // ============ 資產處理 ============
  const totalEstate = assets.reduce((sum, a) => sum + a.amount, 0);
  const tax = calculateInheritanceTax(totalEstate);
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

    // 檢查目標是否為繼承人
    const targetHeir = heirs.find(h => h.id === targetLocation);
    if (targetHeir && !targetHeir.isHeir) return; // 不能放到非繼承人

    setAssets(prev => prev.map(a =>
      a.id === draggedAsset.id ? { ...a, location: targetLocation } : a
    ));
    setDraggedAsset(null);
  };

  const handleRemoveAsset = (_heirId: string, assetId: string) => {
    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, location: 'pool' } : a));
  };

  const handleAddAsset = (type: AssetType) => {
    const defaultAmounts: Record<AssetType, number> = { cash: 1000000, stock: 2000000, property: 10000000, insurance: 3000000 };
    setAssets(prev => [...prev, {
      id: generateId(),
      type,
      amount: defaultAmounts[type],
      location: 'pool',
    }]);
  };

  const handleAssetAmountChange = (assetId: string, newAmount: number) => {
    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, amount: Math.max(0, newAmount) } : a));
  };

  const poolAssets = assets.filter(a => a.location === 'pool');

  // ============ 渲染 ============
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-amber-900">🏛️ 遺產分配模擬器</h1>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
                ${step === 'FAMILY' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                1. 建立家庭
              </div>
              <Icons.ArrowRight />
              <div className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
                ${step === 'ASSETS' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                2. 分配資產
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {step === 'FAMILY' ? (
          /* ============ Step 1: 家庭資料輸入 ============ */
          <div className="space-y-6">
            {/* 被繼承人 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-amber-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                  <Icons.User />
                </div>
                <h2 className="text-lg font-bold text-gray-800">被繼承人（您）</h2>
              </div>
              <input
                type="text"
                value={family.self.name}
                onChange={(e) => setFamily(prev => ({ ...prev, self: { ...prev.self, name: e.target.value } }))}
                placeholder="請輸入姓名"
                className="w-full max-w-xs p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>

            {/* 配偶 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-amber-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-600">
                  <Icons.Heart />
                </div>
                <h2 className="text-lg font-bold text-gray-800">配偶狀況</h2>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => updateSpouse(true)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all
                    ${family.spouse.status === PersonStatus.ALIVE
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'}`}
                >
                  有配偶
                </button>
                <button
                  onClick={() => updateSpouse(false)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all
                    ${family.spouse.status === PersonStatus.NONE
                      ? 'border-gray-500 bg-gray-50 text-gray-700'
                      : 'border-gray-200 hover:border-gray-300'}`}
                >
                  無配偶
                </button>
              </div>
            </div>

            {/* 父母 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-amber-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  <Icons.Users />
                </div>
                <h2 className="text-lg font-bold text-gray-800">父母狀況</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(['father', 'mother'] as const).map((role) => (
                  <div key={role} className="space-y-2">
                    <label className="font-medium text-gray-600">{role === 'father' ? '父親' : '母親'}</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateParent(role, PersonStatus.ALIVE)}
                        className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm transition-all
                          ${family[role].status === PersonStatus.ALIVE
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        在世
                      </button>
                      <button
                        onClick={() => updateParent(role, PersonStatus.DECEASED)}
                        className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm transition-all
                          ${family[role].status === PersonStatus.DECEASED
                            ? 'border-gray-500 bg-gray-50 text-gray-700'
                            : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        已歿
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 子女 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-amber-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                    <Icons.Users />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">子女狀況</h2>
                </div>
                <button
                  onClick={addChild}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  <Icons.Plus />
                  <span>新增子女</span>
                </button>
              </div>

              {family.children.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
                  目前沒有子女資料，點擊「新增子女」開始添加
                </div>
              ) : (
                <div className="space-y-3">
                  {family.children.map((child, idx) => (
                    <div key={child.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold text-amber-800">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={child.name}
                        onChange={(e) => updateChildName(child.id, e.target.value)}
                        placeholder="子女姓名"
                        className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        onClick={() => removeChild(child.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 下一步按鈕 */}
            <button
              onClick={() => setStep('ASSETS')}
              className="w-full py-4 bg-amber-900 text-white text-lg font-bold rounded-xl shadow-lg hover:bg-amber-800 transition-colors flex items-center justify-center gap-2"
            >
              <Icons.Check />
              下一步：分配資產
            </button>
          </div>
        ) : (
          /* ============ Step 2: 資產分配 ============ */
          <div className="space-y-6">
            {/* 返回按鈕 */}
            <button
              onClick={() => setStep('FAMILY')}
              className="flex items-center gap-2 text-amber-700 hover:text-amber-900 transition-colors"
            >
              <Icons.ArrowLeft />
              <span>返回修改家庭資料</span>
            </button>

            {/* 總覽卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
                <div className="text-sm text-gray-500 mb-1">遺產總額</div>
                <div className="text-2xl font-bold text-gray-800">{formatMoney(totalEstate)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100">
                <div className="text-sm text-gray-500 mb-1">遺產稅（估算）</div>
                <div className="text-2xl font-bold text-red-500">-{formatMoney(tax)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100">
                <div className="text-sm text-gray-500 mb-1">可分配金額</div>
                <div className="text-2xl font-bold text-green-600">{formatMoney(afterTaxEstate)}</div>
              </div>
            </div>

            {/* 繼承系統表 + 資產分配 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-amber-100">
              <h2 className="text-lg font-bold text-gray-800 mb-4">👨👩👧👦 繼承系統表</h2>
              <p className="text-sm text-gray-500 mb-6">綠框為有繼承權者，將下方資產拖拉到繼承人卡片上進行分配</p>

              {/* 被繼承人 */}
              <div className="flex justify-center mb-6">
                <div className="bg-amber-100 border-2 border-amber-400 rounded-xl p-4 text-center">
                  <div className="text-3xl mb-2">👤</div>
                  <div className="font-bold text-amber-900">{family.self.name}</div>
                  <div className="text-xs text-amber-600">被繼承人</div>
                </div>
              </div>

              {/* 連接線 */}
              <div className="flex justify-center mb-4">
                <div className="w-0.5 h-8 bg-gray-300"></div>
              </div>

              {/* 繼承人卡片 */}
              <div className="flex flex-wrap justify-center gap-4">
                {heirs.length === 0 ? (
                  <div className="text-gray-400 py-8">請先設定家庭成員</div>
                ) : (
                  heirs.map((heir) => (
                    <HeirCard
                      key={heir.id}
                      heir={heir}
                      assets={assets.filter(a => a.location === heir.id)}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onRemoveAsset={handleRemoveAsset}
                      legalShare={heir.legalShare}
                      totalEstate={afterTaxEstate}
                      isHeir={heir.isHeir}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 資產池 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-amber-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">📦 資產池</h2>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(ASSET_TYPES) as [AssetType, { name: string; color: string; icon: string }][]).map(([key, type]) => (
                    <button
                      key={key}
                      onClick={() => handleAddAsset(key)}
                      className="px-3 py-1.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
                      style={{ backgroundColor: type.color }}
                    >
                      {type.icon} +
                    </button>
                  ))}
                </div>
              </div>

              <div
                onDrop={(e) => handleDrop(e, 'pool')}
                onDragOver={handleDragOver}
                className="min-h-[120px] border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50"
              >
                <div className="flex flex-wrap gap-3">
                  {poolAssets.map((asset) => (
                    <div key={asset.id} className="relative group">
                      <AssetBlock asset={asset} onDragStart={handleDragStart} />
                      <input
                        type="number"
                        value={asset.amount}
                        onChange={(e) => handleAssetAmountChange(asset.id, parseInt(e.target.value) || 0)}
                        className="absolute -bottom-7 left-0 right-0 text-xs text-center bg-white border rounded px-1 py-0.5
                          opacity-0 group-hover:opacity-100 transition-opacity w-full"
                        step={100000}
                      />
                    </div>
                  ))}
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

            {/* 說明 */}
            <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
              <h3 className="font-bold text-amber-900 mb-3">📚 使用說明</h3>
              <ul className="text-sm text-amber-800 space-y-1.5">
                <li>• <strong>拖拉分配</strong>：將資產方塊從資產池拖到繼承人卡片</li>
                <li>• <strong>調整金額</strong>：滑鼠移到方塊上可修改金額</li>
                <li>• <strong>新增資產</strong>：點擊資產池右上角的按鈕</li>
                <li>• <strong>特留分警告</strong>：低於特留分時卡片會變紅</li>
              </ul>
              <div className="mt-4 p-3 bg-white/50 rounded-lg text-sm text-amber-700">
                💡 本工具僅供參考，實際遺產規劃請諮詢專業顧問
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
