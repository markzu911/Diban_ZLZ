import { useState, type ReactNode, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Upload, 
  Image as ImageIcon, 
  ChevronRight,
  CheckCircle2,
  Maximize2,
  Box,
  Sparkles,
  Sun,
  Palette,
  Home,
  ShieldCheck,
  Search,
  Plus,
  Loader2,
  Download,
  Share2,
  Layers,
  X,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// --- Types ---

type AspectRatio = '1:1' | '3:4' | '4:3' | '16:9';
type Quality = '1K' | '2K' | '4K';
type ViewAngle = '对角线' | '近景' | '细节';

interface Step3State {
  spaceType: string;
  designStyle: string;
  targetFloor: string;
  floorDetails?: {
    shape?: string;
    pattern?: string;
    texture?: string;
    finish?: string;
    relief?: string; // Physical bumps/protrusions
  };
  lighting: string;
  obstacles: string[];
}

interface RenderResult {
  id: string;
  time: string;
  img: string;
  angle: ViewAngle;
  prompt: string;
  params: Step3State;
}

// --- UI Components ---

const PreviewModal = ({ img, onClose }: { img: string, onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 sm:p-12"
    onClick={onClose}
  >
    <button 
      onClick={onClose}
      className="absolute top-8 right-8 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-20"
    >
      <X className="w-6 h-6" />
    </button>
    <motion.img 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      src={img} 
      className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
      alt="Preview" 
      onClick={(e) => e.stopPropagation()}
    />
  </motion.div>
);

const Card = ({ children, className = "" }: { children: ReactNode, className?: string }) => (
  <div className={`bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-8 ${className}`}>
    {children}
  </div>
);

const StepHeader = ({ step, title, subtitle }: { step: string, title: string, subtitle?: string }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 mb-1">
      <div className="bg-[#5B50FF]/10 px-3 py-1 rounded-full">
        <span className="text-[#5B50FF] font-black text-xs uppercase italic">{step}</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    </div>
    {subtitle && <p className="text-gray-400 text-xs leading-relaxed mt-1">{subtitle}</p>}
  </div>
);

const UploadBox = ({ 
  icon: Icon, 
  label, 
  sublabel, 
  height = "h-[240px]", 
  img, 
  onUpload,
  isLoading = false
}: { 
  icon: any, 
  label: string, 
  sublabel?: string, 
  height?: string, 
  img?: string | null,
  onUpload: (file: File) => void,
  isLoading?: boolean
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  
  return (
    <div 
      onClick={() => !isLoading && fileRef.current?.click()}
      className={`group relative w-full ${height} border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[#5B50FF]/30 transition-all bg-gray-50/50 overflow-hidden`}
    >
      <input 
        type="file" 
        hidden 
        ref={fileRef} 
        accept="image/*" 
        onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
      />
      {isLoading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#5B50FF] animate-spin" />
          <span className="text-xs font-bold text-[#5B50FF] uppercase tracking-widest">AI 正在深度解析</span>
        </div>
      ) : img ? (
        <>
          <img src={img} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="Uploaded" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-white px-4 py-2 rounded-full text-xs font-bold text-gray-900 shadow-xl flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform">
              <Plus className="w-3 h-3" /> 点击更换
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 group-hover:shadow-[#5B50FF]/20 transition-all">
            <Icon className="w-6 h-6 text-[#5B50FF]" />
          </div>
          <span className="text-gray-900 font-bold text-sm tracking-tight">{label}</span>
          {sublabel && <span className="text-gray-400 text-[10px] mt-1.5 uppercase font-medium">{sublabel}</span>}
        </>
      )}
    </div>
  );
};

const ToggleGroup = ({ options, active, onChange }: { options: string[], active: string, onChange: (val: any) => void }) => (
  <div className="flex gap-2 p-1.5 bg-gray-50 rounded-2xl w-full sm:w-fit border border-gray-100">
    {options.map((opt) => (
      <button
        key={opt}
        onClick={() => onChange(opt)}
        className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all ${
          active === opt 
            ? 'bg-[#5B50FF] text-white shadow-[0_4px_12px_rgba(91,80,255,0.3)]' 
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'
        }`}
      >
        {opt}
      </button>
    ))}
  </div>
);

const SelectField = ({ label, icon: Icon, value, options, onChange }: { label: string, icon: any, value: string, options: string[], onChange: (v: string) => void }) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-gray-400 text-[10px] uppercase tracking-widest font-black ml-1">
      <Icon className="w-3 h-3" />
      {label}
    </label>
    <div className="relative">
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#5B50FF]/20 cursor-pointer"
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none rotate-90" />
    </div>
  </div>
);

const DisplayField = ({ label, icon: Icon, value }: { label: string, icon: any, value: string }) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-gray-400 text-[10px] uppercase tracking-widest font-black ml-1">
      <Icon className="w-3 h-3" />
      {label}
    </label>
    <div className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-400 flex items-center gap-2">
      <div className="w-1.5 h-1.5 bg-[#5B50FF] rounded-full" />
      {value}
    </div>
  </div>
);

// --- SaaS Integration Types ---
interface SaaSUser {
  name: string;
  enterprise: string;
  integral: number;
}

interface SaasTool {
  name: string;
  integral: number;
}

interface SaaSState {
  userId: string | null;
  toolId: string | null;
  user: SaaSUser | null;
  tool: SaasTool | null;
  initialized: boolean;
  isVerifying: boolean;
  insufficientPoints: boolean;
}

export default function App() {
  // --- SaaS State ---
  const [saas, setSaas] = useState<SaaSState>({
    userId: null,
    toolId: null,
    user: null,
    tool: null,
    initialized: false,
    isVerifying: false,
    insufficientPoints: false
  });

  // --- postMessage Integration ---
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SAAS_INIT') {
        const { userId, toolId, context, prompt: saasPrompts } = event.data;
        
        // ID Filtering
        const cleanUserId = (userId === "null" || userId === "undefined") ? null : userId;
        const cleanToolId = (toolId === "null" || toolId === "undefined") ? null : toolId;

        if (cleanUserId && cleanToolId) {
          setSaas(prev => ({ ...prev, userId: cleanUserId, toolId: cleanToolId }));
          
          // Apply initial context/prompts if provided
          if (context || saasPrompts) {
            setStep3(prev => ({
              ...prev,
              obstacles: Array.isArray(saasPrompts) ? [...prev.obstacles, ...saasPrompts] : prev.obstacles,
              spaceType: context || prev.spaceType
            }));
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- SaaS 1: Launch ---
  useEffect(() => {
    const launchTool = async () => {
      if (saas.userId && saas.toolId && !saas.initialized) {
        try {
          const response = await axios.post('/api/tool/launch', {
            userId: saas.userId,
            toolId: saas.toolId
          });
          if (response.data.success) {
            setSaas(prev => ({
              ...prev,
              user: response.data.data.user,
              tool: response.data.data.tool,
              initialized: true
            }));
          }
        } catch (error) {
          console.error("SaaS Launch Failed:", error);
        }
      }
    };
    launchTool();
  }, [saas.userId, saas.toolId, saas.initialized]);

  const [roomImg, setRoomImg] = useState<string | null>(null);
  const [roomImgBase64, setRoomImgBase64] = useState<string | null>(null);
  const [materialImg, setMaterialImg] = useState<string | null>(null);
  const [materialImgBase64, setMaterialImgBase64] = useState<string | null>(null);
  const [isAnalyzingRoom, setIsAnalyzingRoom] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [step3, setStep3] = useState<Step3State>({
    spaceType: '客餐厅',
    designStyle: '现代简约',
    targetFloor: '实木多层板',
    lighting: '自然天光',
    obstacles: []
  });

  const [aspect, setAspect] = useState<AspectRatio>('3:4');
  const [quality, setQuality] = useState<Quality>('2K');
  const [angles, setAngles] = useState<ViewAngle[]>(['对角线']);
  const [history, setHistory] = useState<RenderResult[]>([]);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const toggleAngle = (v: ViewAngle) => {
    setAngles(prev => 
      prev.includes(v) 
        ? prev.filter(a => a !== v) 
        : [...prev, v]
    );
  };

  const [customFurniture, setCustomFurniture] = useState('');

  // --- Helper: File to Base64 ---
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // --- Step 1: Analysis ---
  const handleRoomUpload = async (file: File) => {
    const url = URL.createObjectURL(file);
    setRoomImg(url);
    setRoomImgBase64(null); // Clear previous to prevent mixups
    setIsAnalyzingRoom(true);

    try {
      const base64 = await fileToBase64(file);
      setRoomImgBase64(base64);
      const pureBase64 = base64.split(',')[1];

      const prompt = `Analyze this room image for floor replacement. Identify:
      1. Space Type (e.g. Living Room, Bedroom)
      2. Design Style (e.g. Modern, Vintage)
      3. Current Floor Type
      4. Lighting conditions
      5. Furniture/Obstacles to preserve.
      Return JSON format: {spaceType, designStyle, currentFloor, lighting, obstacles: string[]}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: prompt },
          { inlineData: { mimeType: file.type, data: pureBase64 } }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              spaceType: { type: Type.STRING },
              designStyle: { type: Type.STRING },
              currentFloor: { type: Type.STRING },
              lighting: { type: Type.STRING },
              obstacles: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setStep3({
        spaceType: data.spaceType || '客餐厅',
        designStyle: data.designStyle || '现代简约',
        targetFloor: data.currentFloor || '实木多层板',
        lighting: data.lighting || '自然天光',
        obstacles: data.obstacles || []
      });
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsAnalyzingRoom(false);
    }
  };

  const handleMaterialUpload = async (file: File) => {
    const url = URL.createObjectURL(file);
    setMaterialImg(url);
    setMaterialImgBase64(null);
    setIsAnalyzingRoom(true); 

    try {
      const base64 = await fileToBase64(file);
      setMaterialImgBase64(base64);
      const pureBase64 = base64.split(',')[1];

      const prompt = `Identify this flooring material sample. 
      Analyze with extreme care for physical surface characteristics:
      1. Material Name (e.g. "Natural Oak")
      2. Shape of the units (e.g. "rectangular planks", "square tiles", "hexagon")
      3. Pattern/Layout (e.g. "Herringbone", "Fishbone", "Straight", "Chessboard")
      4. Texture/Grain (e.g. "deep wood grain", "smooth marble", "coarse stone")
      5. Physical Relief/Bumps (e.g. "wavy irregular protrusions", "deeply embossed grain", "flat smooth surface", "three-dimensional relief"). 
      6. Finish/Surface (e.g. "matte", "glossy", "brushed", "satin")
      Return JSON: { materialName, shape, pattern, texture, relief, finish }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: prompt },
          { inlineData: { mimeType: file.type, data: pureBase64 } }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              materialName: { type: Type.STRING },
              shape: { type: Type.STRING },
              pattern: { type: Type.STRING },
              texture: { type: Type.STRING },
              relief: { type: Type.STRING },
              finish: { type: Type.STRING }
            }
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      if (data.materialName) {
        setStep3(prev => ({ 
          ...prev, 
          targetFloor: data.materialName,
          floorDetails: data
        }));
      }
    } catch (error) {
      console.error("Material analysis failed", error);
    } finally {
      setIsAnalyzingRoom(false);
    }
  };

  // --- AI Recommend Material ---
  const handleAIRecommend = async () => {
    if (!roomImgBase64) return;
    setIsAnalyzingRoom(true);
    try {
      const pureBase64 = roomImgBase64.split(',')[1];
      const prompt = `Based on this room image, recommend a flooring material that would look best. 
      Consider the wall color, lighting, and existing style. 
      Return JSON: { 
        name: string, 
        reason: string,
        details: { color: string, shape: string, pattern: string, texture: string, relief: string, finish: string } 
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: pureBase64 } }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              reason: { type: Type.STRING },
              details: {
                type: Type.OBJECT,
                properties: {
                  color: { type: Type.STRING, description: "Precise color name (e.g. 'Coffee Brown', 'Creamy White')" },
                  shape: { type: Type.STRING },
                  pattern: { type: Type.STRING },
                  texture: { type: Type.STRING },
                  relief: { type: Type.STRING },
                  finish: { type: Type.STRING }
                }
              }
            }
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      if (data.name) {
        setStep3(prev => ({ 
          ...prev, 
          targetFloor: data.name,
          floorDetails: data.details || prev.floorDetails
        }));
        setMaterialImg(null);
        setMaterialImgBase64(null);
      }
    } catch (error) {
      console.error("AI recommendation failed", error);
    } finally {
      setIsAnalyzingRoom(false);
    }
  };

  // --- Step 5: Generate ---
  const handleGenerate = async () => {
    if (!roomImg || angles.length === 0) return;
    
    // --- SaaS 2: Verify ---
    if (saas.userId && saas.toolId) {
      setSaas(prev => ({ ...prev, isVerifying: true, insufficientPoints: false }));
      try {
        const verifyRes = await axios.post('/api/tool/verify', {
          userId: saas.userId,
          toolId: saas.toolId
        });
        
        if (!verifyRes.data.success && !verifyRes.data.valid) {
          setSaas(prev => ({ ...prev, insufficientPoints: true, isVerifying: false }));
          return;
        }
      } catch (error) {
        console.error("SaaS Verify Error:", error);
        // Fail-safe: allowing if request fails but we should be careful here
      } finally {
        setSaas(prev => ({ ...prev, isVerifying: false }));
      }
    }

    setIsGenerating(true);
    const newResults: RenderResult[] = [];
    
    try {
      for (const angle of angles) {
        // ... previous logic
        let anglePrompt = "";
        
        // Detailed Logic per Angle
        if (angle === '对角线') {
          anglePrompt = `[CAMERA & PERSPECTIVE: DIAGONAL WIDE VIEW]
          - Camera: 24mm wide-angle lens, precisely set at a height of 1.75m to simulate a high-vantage downward perspective.
          - Composition: Positioned in a room corner, shooting at a horizontal 45-degree angle across the space. 
          - Purpose: This specific angle is designed to maximize the sense of depth and extension of the new ${step3.targetFloor}. 
          - Lighting: Broad natural architectural lighting.
          - Vibe: Professional real estate photography emphasizing spatial flow.`;
        } else if (angle === '近景') {
          anglePrompt = `[CAMERA & PERSPECTIVE: MID-RANGE LIFESTYLE]
          - Camera: 50mm lens. Distance from the lens to the key furniture is approximately 2 meters.
          - Composition: A partial/modular close-up focus. Include only 2 to 3 key furniture pieces (e.g., ${step3.obstacles.slice(0, 3).join(', ') || 'sofa corner, table leg, and rug'}). 
          - Framing: Crop the shot to show partial furniture (e.g., only the right half of a sofa, a portion of the floor) to create a modern, curated lifestyle look.
          - Focus: Sharp focus on the floor texture where it meets the furniture bases, with a slightly soft background.
          - Lighting: Targeted side-lighting to emphasize ${step3.floorDetails?.relief || 'the physical surface relief'}.`;
        } else if (angle === '细节') {
          anglePrompt = `[CAMERA & PERSPECTIVE: MACRO DETAIL]
          - Camera: 100mm macro lens, extreme close-up.
          - Composition: A bird's-eye view looking 45 degrees down at the floor surface from 40cm height. No furniture visible. The frame is 100% focused on the floor material.
          - Key Features: Emphasize the ${step3.floorDetails?.texture || 'deep grain'}, the ${step3.floorDetails?.relief || 'physical bumps/relief'}, and the ${step3.floorDetails?.finish || 'matte/glossy'} sheen. 
          - Detail: Show the micro-texture of the joints and the tactile quality of the ${step3.targetFloor}.
          - Lighting: High-contrast directional lighting to cast tiny shadows in the recesses of the texture.`;
        }

        const floorDesc = `TARGET FLOOR REPLACEMENT:
        - Absolute Material: ${step3.targetFloor}
        - Color Integrity: ${materialImgBase64 ? 'Extract and replicate the EXACT hex-color and tonal values from Image 2.' : `Strictly use the color: ${step3.floorDetails?.color || 'as described in material name'}.`}
        - Shape & Pattern: ${step3.floorDetails?.shape || 'Standard'} with ${step3.floorDetails?.pattern || 'Seamless'} layout.
        - Surface Detail: Match the physical relief/bumps (${step3.floorDetails?.relief || 'High-fidelity'}) and sheen (${step3.floorDetails?.finish || 'Natural'}) precisely.`;

        const renderPrompt = `TASK: PRECISION ARCHITECTURAL FLOOR REPLACEMENT
        
        CRITICAL COLOR RULE: The output floor MUST match the exact chroma, saturation, and hue of the target material from Image 2. 
        DO NOT allow the room's environmental lighting to fundamentally shift the perceived color of the material (no yellowing from warm lights or bluing from cold lights). 
        The material's native color is the priority.
        
        INPUTS:
        - Image 1: Room Geometry & Furniture (Preserve: ${step3.obstacles.join(', ')}).
        ${materialImgBase64 ? '- Image 2: CHROMINANCE MASTER. This is the absolute truth for color. Replicate it 1:1.' : ''}

        ${anglePrompt}

        ${floorDesc}

        ENVIRONMENT: ${step3.lighting} light. Preserve original room color temperature while applying the new floor.
        QUALITY: Photorealistic, 8k, physically accurate render.`;

        const renderParts: any[] = [];
        if (roomImgBase64) {
          renderParts.push({ inlineData: { mimeType: "image/png", data: roomImgBase64.split(',')[1] } });
        }
        if (materialImgBase64) {
          renderParts.push({ inlineData: { mimeType: "image/png", data: materialImgBase64.split(',')[1] } });
        }
        renderParts.push({ text: renderPrompt });

        const aiResponse = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: [{ parts: renderParts }],
          config: {
            imageConfig: {
              aspectRatio: aspect,
            }
          }
        });

        let imageUrl = "";
        for (const part of aiResponse.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        if (imageUrl) {
          newResults.push({
            id: Math.random().toString(36).substr(2, 9),
            time: new Date().toLocaleString(),
            img: imageUrl,
            angle,
            prompt: renderPrompt,
            params: { ...step3 }
          });
        }
      }

      // --- SaaS 3: Consume ---
      if (saas.userId && saas.toolId && newResults.length > 0) {
        try {
          const consumeRes = await axios.post('/api/tool/consume', {
            userId: saas.userId,
            toolId: saas.toolId
          });
          if (consumeRes.data.success) {
            setSaas(prev => ({
              ...prev,
              user: prev.user ? {
                ...prev.user,
                integral: consumeRes.data.data.currentIntegral
              } : null
            }));
          }
        } catch (error) {
          console.error("SaaS Consume Error:", error);
        }
      }

      setHistory(prev => [...newResults, ...prev]);
    } catch (error) {
      console.error("Generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (img: string, id: string) => {
    const link = document.createElement('a');
    link.href = img;
    link.download = `floor-ai-render-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] font-sans text-gray-900 pb-20 selection:bg-[#5B50FF]/10">
      {/* SaaS User Bar */}
      {saas.initialized && saas.user && (
        <div className="bg-white border-b border-gray-100 px-6 py-3 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-white/80">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-tr from-[#5B50FF] to-[#8B50FF] rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-[#5B50FF]/20">
                {saas.user.name.charAt(0)}
              </div>
              <div>
                <h4 className="text-sm font-black text-gray-900 leading-tight tracking-tight uppercase italic">{saas.user.name}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{saas.user.enterprise}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-0.5">我的积分资产</span>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-[#5B50FF]" />
                  <span className="text-lg font-black text-gray-900 italic tracking-tighter">{saas.user.integral}</span>
                </div>
              </div>
              <div className="h-8 w-px bg-gray-100" />
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-0.5">当前工具消耗</span>
                <span className="text-sm font-black text-[#5B50FF] italic tracking-tight">-{saas.tool?.integral || 10} / 次</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Alerts */}
        <AnimatePresence>
          {saas.insufficientPoints && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 shadow-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-bold tracking-tight">账户积分不足，无法启动渲染。请及时充值或联系管理员。</p>
              <button 
                onClick={() => setSaas(p => ({ ...p, insufficientPoints: false }))}
                className="ml-auto text-xs font-black uppercase tracking-widest bg-white px-4 py-2 rounded-xl shadow-sm border border-red-100 hover:bg-red-100 transition-colors"
              >
                我知道了
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Top Section Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Input Sources */}
          <div className="lg:col-span-4 space-y-8">
            <Card className="relative">
              <StepHeader 
                step="Step 01" 
                title="上传房间全景" 
                subtitle="室内照片经由 AI 进行物理语义解析，自动锁定现有地面区域" 
              />
              <UploadBox 
                icon={Upload} 
                label="上传场景图" 
                sublabel="AI 自动识别地板边缘" 
                img={roomImg}
                onUpload={handleRoomUpload}
                isLoading={isAnalyzingRoom}
              />
              {roomImg && !isAnalyzingRoom && (
                <div className="mt-6 flex items-center justify-between p-3 bg-green-50/50 rounded-xl border border-green-100">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <span className="text-[10px] font-bold text-green-700 italic uppercase tracking-wider text-ellipsis overflow-hidden">Analysis Complete</span>
                  </div>
                  <span className="text-[10px] font-bold text-green-600 whitespace-nowrap">识别成功</span>
                </div>
              )}
            </Card>

            <Card>
              <StepHeader 
                step="Step 02" 
                title="选择地板材质" 
                subtitle="AI 可根据场景图自动推荐款式，或由您手动提供材质产品大样图" 
              />
              <UploadBox 
                icon={ImageIcon} 
                label="上传材质产品图" 
                sublabel="推荐 800x800px 贴图"
                height="h-[180px]" 
                img={materialImg}
                onUpload={handleMaterialUpload}
              />
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button 
                  onClick={handleAIRecommend}
                  disabled={isAnalyzingRoom || !roomImg}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-bold text-gray-600 hover:bg-[#5B50FF]/5 hover:border-[#5B50FF]/30 transition-all group disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#5B50FF] group-hover:animate-pulse" />
                  AI 智能推荐
                </button>
                <div className="flex gap-2 overflow-x-auto no-scrollbar items-center px-1">
                  {['原木', '鱼骨', '石纹'].map(t => (
                    <span key={t} className="px-3 py-1 bg-gray-100 rounded-full text-[9px] font-black text-gray-400 uppercase tracking-tighter cursor-help hover:bg-gray-200 shrink-0">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Right: Analysis & Config */}
          <div className="lg:col-span-8 space-y-8">
            <Card className="relative overflow-hidden">
              <StepHeader 
                step="Step 03" 
                title="细化空间与障碍回避" 
                subtitle="AI 分析生成的基准数据。调整参数以补偿光影并保护重点家具陈设" 
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Logic Controls */}
                <div className="space-y-6">
                  <SelectField 
                    label="空间性质" 
                    icon={Home} 
                    value={step3.spaceType} 
                    options={['客餐厅', '卧室', '办公空间', '商业零售', '厨卫']} 
                    onChange={(v) => setStep3({...step3, spaceType: v})}
                  />
                  <SelectField 
                    label="设计风格" 
                    icon={Palette} 
                    value={step3.designStyle} 
                    options={['现代简约', '意式极简', '法式复古', '奶油风', '原木风', '工业风']} 
                    onChange={(v) => setStep3({...step3, designStyle: v})}
                  />
                  <DisplayField 
                    label="目标地板" 
                    icon={Layers} 
                    value={step3.targetFloor} 
                  />
                  <SelectField 
                    label="渲染光彩" 
                    icon={Sun} 
                    value={step3.lighting} 
                    options={['自然天光', '温暖夕暮', '冷感月影', '智能无主灯', '电影聚光']} 
                    onChange={(v) => setStep3({...step3, lighting: v})}
                  />
                </div>

                {/* Furniture Preserve */}
                <div className="bg-[#5B50FF]/5 p-6 rounded-[28px] border border-[#5B50FF]/10 shadow-inner flex flex-col min-h-[220px]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="space-y-1">
                      <label className="text-[#5B50FF] text-[10px] uppercase tracking-[0.2em] font-black flex items-center gap-2">
                         <Box className="w-4 h-4" /> 
                         场景陈设：保留物品
                      </label>
                      <p className="text-[10px] text-gray-400 font-bold">渲染时 AI 将避开这些区域并生成阴影</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-[#5B50FF]/20">
                      <div className="w-1.5 h-1.5 bg-[#5B50FF] rounded-full animate-pulse" />
                      <span className="text-[10px] text-[#5B50FF] font-black uppercase tracking-tighter">智能避障模式</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2.5 mb-6">
                    {step3.obstacles.length > 0 ? (
                      step3.obstacles.map(item => (
                        <motion.div 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          key={item} 
                          className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 text-xs font-black text-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] group"
                        >
                          <div className="w-1.5 h-1.5 bg-[#5B50FF] rounded-full opacity-40 group-hover:opacity-100 transition-opacity" />
                          {item}
                          <button 
                            onClick={() => setStep3({...step3, obstacles: step3.obstacles.filter(o => o !== item)})}
                            className="text-gray-300 hover:text-red-500 transition-colors ml-1 p-0.5 hover:bg-red-50 rounded-md"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))
                    ) : (
                      <div className="w-full py-8 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl bg-white/50">
                        <Search className="w-8 h-8 text-gray-200 mb-2" />
                        <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest">暂无保留物品</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto space-y-4">
                    <div className="flex items-center bg-white rounded-2xl border-2 border-gray-100 px-4 h-14 shadow-sm focus-within:border-[#5B50FF] focus-within:shadow-[0_0_0_4px_rgba(91,80,255,0.05)] transition-all">
                      <Plus className="w-4 h-4 text-[#5B50FF] mr-3" />
                      <input 
                        type="text" 
                        placeholder="手动输入需要保留的物品名称（如：右侧落地灯）..." 
                        className="bg-transparent text-xs font-bold w-full focus:outline-none placeholder:text-gray-400"
                        value={customFurniture}
                        onChange={(e) => setCustomFurniture(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customFurniture.trim()) {
                            if (!step3.obstacles.includes(customFurniture.trim())) {
                              setStep3({...step3, obstacles: [...step3.obstacles, customFurniture.trim()]});
                            }
                            setCustomFurniture('');
                          }
                        }}
                      />
                      <button 
                        onClick={() => {
                          if (customFurniture.trim() && !step3.obstacles.includes(customFurniture.trim())) {
                            setStep3({...step3, obstacles: [...step3.obstacles, customFurniture.trim()]});
                            setCustomFurniture('');
                          }
                        }}
                        className="px-4 py-1.5 bg-gray-50 hover:bg-gray-100 text-[10px] font-black uppercase text-gray-400 rounded-lg transition-colors shrink-0"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Step 4: Config */}
            <Card>
              <StepHeader step="Step 04" title="渲染参数配置" subtitle="调整最终画质与比例，建议 2K 及以上分辨率用于正式交付" />
              
              <div className="space-y-8">
                <div className="flex flex-wrap gap-12">
                  <div>
                    <label className="block text-gray-400 text-[10px] uppercase tracking-wider font-black mb-3 ml-1">输出比例</label>
                    <ToggleGroup 
                      options={['1:1', '3:4', '4:3', '16:9']} 
                      active={aspect} 
                      onChange={setAspect} 
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-[10px] uppercase tracking-wider font-black mb-3 ml-1">渲染品质</label>
                    <ToggleGroup 
                      options={['1K', '2K', '4K']} 
                      active={quality} 
                      onChange={setQuality} 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-[10px] uppercase tracking-wider font-black mb-3 ml-1">拍摄视角（可多选）</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
                    {(['对角线', '近景', '细节'] as ViewAngle[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => toggleAngle(v)}
                        className={`py-3.5 px-6 rounded-2xl text-xs font-black tracking-widest uppercase transition-all border-2 ${
                          angles.includes(v) 
                            ? 'bg-[#5B50FF] text-white border-[#5B50FF] shadow-[0_8px_24px_rgba(91,80,255,0.3)]' 
                            : 'bg-white text-gray-400 border-gray-50 hover:border-gray-200'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Step 5: Generate */}
            <div className="space-y-4">
              <button 
                onClick={handleGenerate}
                disabled={isGenerating || !roomImg || saas.isVerifying}
                className="w-full h-[140px] bg-[#0A0D18] rounded-[32px] group relative overflow-hidden flex flex-col items-center justify-center text-white transition-all active:scale-[0.98] hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#5B50FF]/2 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1500ms] cubic-bezier(0.4, 0, 0.2, 1)" />
                <div className="w-14 h-14 bg-[#5B50FF] rounded-2xl flex items-center justify-center shadow-[0_4px_24px_rgba(91,80,255,0.4)] mb-3 group-hover:scale-110 transition-transform">
                  {isGenerating || saas.isVerifying ? <Loader2 className="w-7 h-7 animate-spin" /> : <Sparkles className="w-7 h-7" />}
                </div>
                <h3 className="text-2xl font-black italic tracking-tight uppercase leading-none">
                  {isGenerating ? '正在生成渲染管线...' : saas.isVerifying ? '正在校验资产' : '开启全景替换渲染'}
                </h3>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-2 overflow-hidden whitespace-nowrap text-ellipsis px-10">
                  {isGenerating ? '正在调用深度神经网络' : saas.isVerifying ? '正在接洽 SaaS 授权服务器' : `${angles.length} 个视角准备就绪 • 预计消耗 ${saas.tool?.integral ? saas.tool.integral : 10} 积分`}
                </p>
              </button>
              
              {saas.initialized && saas.user && (
                <div className="flex items-center justify-between px-6 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">SaaS 权限层已在线</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">资产余额:</span>
                    <span className="text-xs font-black text-gray-900 italic">{saas.user.integral} pts</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Designs Section */}
        <section className="mt-28" id="history-section">
          <div className="flex items-center justify-between mb-10 border-b border-gray-100 pb-6">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight italic uppercase">Recent Works</h2>
              <p className="text-gray-400 text-sm mt-1 font-bold">已生成的提案历史汇集</p>
            </div>
            <button 
              onClick={() => setHistory([])}
              className="px-8 py-3 bg-white border-2 border-gray-50 rounded-2xl text-xs font-black uppercase text-gray-400 hover:text-red-500 hover:border-red-100 transition-all tracking-widest shadow-sm"
            >
              清楚所有记录
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
              {history.map((design) => (
                <motion.div 
                  key={design.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -12 }}
                  className="group relative aspect-[4/5] rounded-[28px] overflow-hidden bg-white shadow-xl cursor-default"
                >
                  <img 
                    src={design.img} 
                    alt="Recent Design" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1200ms] ease-out"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-40 group-hover:opacity-80 transition-opacity duration-700" />
                  
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex flex-col gap-1 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                      <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">{design.time}</span>
                      <h4 className="text-white text-base font-bold flex items-center gap-2">
                        {design.angle} 视角方案
                        <div className="w-8 h-px bg-white/30" />
                      </h4>
                    </div>
                  </div>

                  <div className="absolute top-6 right-6 flex flex-col gap-2 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500">
                    <button 
                      onClick={() => handleDownload(design.img, design.id)}
                      className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/40 hover:bg-white/40 transition-colors"
                    >
                      <Download className="w-4 h-4 text-white" />
                    </button>
                    <button 
                      onClick={() => setPreviewImg(design.img)}
                      className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/40 hover:bg-white/40 transition-colors"
                    >
                      <Maximize2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {history.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-300 gap-4">
                <Box className="w-12 h-12 stroke-[1px]" />
                <span className="text-sm font-bold uppercase tracking-widest italic">暂无历史渲染记录</span>
              </div>
            )}
          </div>
        </section>

        <AnimatePresence>
          {previewImg && <PreviewModal img={previewImg} onClose={() => setPreviewImg(null)} />}
        </AnimatePresence>

        <footer className="mt-40 text-center border-t border-gray-100 pt-20">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">
            <span className="hover:text-[#5B50FF] transition-colors cursor-default">GEMINI 2.5 FLASH</span>
            <span className="hover:text-[#5B50FF] transition-colors cursor-default">STABLE DIFFUSION XL</span>
            <span className="hover:text-[#5B50FF] transition-colors cursor-default">VISION ENGINE V1.2</span>
          </div>
          <p className="text-gray-400 text-[10px] font-bold mt-10 uppercase tracking-widest opacity-50">© 2026 FLOORAI SYSTEM. EMPOWERED BY NEXT-GEN SPATIAL AI.</p>
        </footer>
      </main>
    </div>
  );
}
