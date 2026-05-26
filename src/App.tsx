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
  AlertCircle,
  Video as VideoIcon,
  Menu,
  ChevronLeft,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Type } from "@google/genai";
import { callGemini } from './lib/gemini';

import { resizeImage } from './lib/image-utils';

import { persistResultImage, getDirectUploadToken, commitUpload } from './lib/upload';

// --- Types ---

interface GalleryImage {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

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

const Card = ({ children, className = "", title, icon }: { children: ReactNode, className?: string, title?: string, icon?: ReactNode }) => (
  <div className={`bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-8 ${className}`}>
    {(title || icon) && (
      <div className="flex items-center gap-3 mb-6">
        {icon && <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">{icon}</div>}
        {title && <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest italic">{title}</h3>}
      </div>
    )}
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

const Gallery = ({ userId, role, onClose }: { userId: string, role: number, onClose: () => void }) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);

  const fetchImages = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`/api/upload/image?userId=${userId}&role=${role}`);
      if (res.data.success) {
        setImages(res.data.data);
      }
    } catch (error) {
      console.error("Gallery fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteImage = async (id: string) => {
    if (!window.confirm("确定要删除这张图片吗？")) return;
    try {
      const res = await axios.delete(`/api/upload/image`, {
        data: { id, userId, role }
      });
      if (res.data.success) {
        setImages(prev => prev.filter(img => img.id !== id));
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[60] bg-white pt-20 overflow-y-auto"
    >
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">我的图片库</h2>
            <p className="text-gray-400 text-sm font-medium mt-1 uppercase tracking-widest">历史生成的渲染结果</p>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {isLoading ? (
          <div className="h-[400px] flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-[#5B50FF] animate-spin" />
            <span className="text-sm font-black text-gray-300 uppercase tracking-widest">正在同步云端数据</span>
          </div>
        ) : images.length === 0 ? (
          <div className="h-[400px] flex flex-col items-center justify-center gap-6 bg-gray-50/50 rounded-[40px] border-2 border-dashed border-gray-100">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm">
              <ImageIcon className="w-10 h-10 text-gray-200" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-400 mb-1">图片库空空如也</h3>
              <p className="text-gray-300 text-sm font-medium uppercase italic">快去开启你的第一场渲染之旅吧</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map((img) => (
              <motion.div 
                key={img.id}
                layoutId={img.id}
                className="group relative bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all"
              >
                <div className="aspect-[3/4] relative">
                  <img src={img.url} className="w-full h-full object-cover" alt="Gallery" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                    <button 
                      onClick={() => setPreview(img.url)}
                      className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-3 rounded-2xl text-white transition-all transform translate-y-4 group-hover:translate-y-0"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => deleteImage(img.id)}
                      className="bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md p-3 rounded-2xl text-red-100 transition-all transform translate-y-4 group-hover:translate-y-0 delay-75"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-4 border-t border-gray-50">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{new Date(img.createdAt).toLocaleDateString()}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {preview && <PreviewModal img={preview} onClose={() => setPreview(null)} />}
      </AnimatePresence>
    </motion.div>
  );
};

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
        
        // ID Filtering according to V4-3Step spec
        const filterId = (id: any) => (id === "null" || id === "undefined" || !id) ? null : String(id);
        
        const cleanUserId = filterId(userId);
        const cleanToolId = filterId(toolId);

        if (cleanUserId && cleanToolId) {
          setSaas(prev => ({ 
            ...prev, 
            userId: cleanUserId, 
            toolId: cleanToolId,
            initialized: prev.userId === cleanUserId && prev.toolId === cleanToolId ? prev.initialized : false 
          }));
          
          // Apply initial context (SaaS 内容主体) and prompts (补充关键词)
          if (context || saasPrompts) {
            setStep3(prev => ({
              ...prev,
              obstacles: Array.isArray(saasPrompts) 
                ? [...new Set([...prev.obstacles, ...saasPrompts.filter(p => filterId(p))])] 
                : prev.obstacles,
              spaceType: (context && context !== "null") ? context : prev.spaceType
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
  const [pendingRoomFile, setPendingRoomFile] = useState<File | null>(null);
  
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
  const [showGallery, setShowGallery] = useState(false);
  const [currentView, setCurrentView] = useState<'images' | 'video'>('images');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedVideoSourceId, setSelectedVideoSourceId] = useState<string | null>(null);
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);
  const [videoResult, setVideoResult] = useState<string | null>(null);
  const [videoResolution, setVideoResolution] = useState('1080p');
  const [videoAspectRatio, setVideoAspectRatio] = useState('16:9');

  const videoPrompt = `
Luxury interior flooring commercial video.

IMPORTANT:
The ORIGINAL floor from the uploaded room photo no longer exists.
The ENTIRE floor has already been replaced with the NEW flooring material shown in the final generated image.

The video MUST be fully based on the FINAL FLOOR-REPLACED IMAGE.
DO NOT recreate the old flooring.

━━━━━━━━━━━━━━━
SHOT 1 (0-4s)
━━━━━━━━━━━━━━━

Extreme close-up floor cinematic shot.

The camera stays LOW near the ground surface,
only 50-60cm above the floor.

The camera performs a smooth CLOSE-RANGE ORBITAL MOVEMENT around the NEW FLOOR SURFACE itself.

IMPORTANT:
The movement is orbiting around the FLOOR TEXTURE AREA,
NOT around the room.

The frame is dominated by:
- wood grain details
- floor texture
- surface reflections
- premium material finish
- realistic micro details
- luxury craftsmanship

The floor occupies most of the screen.
Furniture and walls remain heavily blurred and secondary.

Macro commercial flooring advertisement style.
Shallow depth of field.
Cinematic lighting.

━━━━━━━━━━━━━━━
HARD CUT AT 4 SECONDS
━━━━━━━━━━━━━━━

A completely different camera setup begins.
NOT a continuous shot.

━━━━━━━━━━━━━━━
SHOT 2 (4-8s)
━━━━━━━━━━━━━━━

First-person cinematic interior view.

The camera slowly moves forward into the room
with a gentle steady push-in movement.

Natural human-eye perspective.
No orbit movement.
No tilt-up movement.
No dramatic camera rotation.

The movement should feel calm, immersive, and realistic,
as if the viewer is walking slowly through the redesigned interior space.

Focus on:
- the overall atmosphere of the room
- harmony between the NEW FLOOR and furniture
- natural sunlight
- premium interior design feeling

The NEW FLOOR must remain visually identical and consistent in both shots.

Ultra realistic.
High-end flooring commercial video.
`;

  const handleGenerateVideo = async () => {
    if (!selectedVideoSourceId) return;
    const selectedSource = history.find(h => h.id === selectedVideoSourceId);
    if (!selectedSource) return;

    setIsVideoGenerating(true);
    setVideoResult(null);
    
    try {
      const startRes = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: videoPrompt,
          imageUrl: selectedSource.img,
          resolution: videoResolution,
          aspectRatio: videoAspectRatio
        }),
      });
      const { operationName, error: startError } = await startRes.json();
      if (startError) throw new Error(startError);

      const poll = async () => {
        try {
          const statusRes = await fetch("/api/video/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operationName }),
          });
          const { done, error: pollError } = await statusRes.json();
          if (pollError) throw new Error(pollError.message || "Polling failed");
          
          if (done) {
            const downloadRes = await fetch("/api/video/download", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ operationName }),
            });
            if (!downloadRes.ok) throw new Error("Download failed");
            const blob = await downloadRes.blob();
            const videoUrl = URL.createObjectURL(blob);
            setVideoResult(videoUrl);
            setIsVideoGenerating(false);
          } else {
            setTimeout(poll, 5000);
          }
        } catch (pollErr: any) {
          console.error("Poll cycle error:", pollErr);
          setIsVideoGenerating(false);
        }
      };

      poll();
    } catch (err: any) {
      console.error("Video Gen Initial Error:", err);
      setIsVideoGenerating(false);
    }
  };

  const toggleAngle = (v: ViewAngle) => {
    setAngles(prev => 
      prev.includes(v) 
        ? prev.filter(a => a !== v) 
        : [...prev, v]
    );
  };

  const [customFurniture, setCustomFurniture] = useState('');

  // --- Helper: File to Base64 (with resizing to prevent 413) ---
  const fileToBase64 = async (file: File): Promise<string> => {
    try {
      // Limit to 1280px (approx 720p - 1080p area) to stay under 1MB proxy limits
      return await resizeImage(file, 1280);
    } catch (error) {
      console.error("Resize failed, falling back to original", error);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });
    }
  };

  // --- Step 1: Upload & Preview ---
  const handleRoomUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setRoomImg(url);
    setPendingRoomFile(file);
    setRoomImgBase64(null);
    setMaterialImg(null);
    setMaterialImgBase64(null);
    setHistory([]);
    setVideoResult(null);
    setSelectedVideoSourceId(null);
  };

  const startRoomAnalysis = async () => {
    if (!pendingRoomFile) return;
    setIsAnalyzingRoom(true);

    try {
      const base64 = await fileToBase64(pendingRoomFile);
      setRoomImgBase64(base64);
      const pureBase64 = base64.split(',')[1];

      const prompt = `Analyze this room image for floor replacement. Identify:
      1. Space Type (e.g. Living Room, Bedroom)
      2. Design Style (e.g. Modern, Vintage)
      3. Current Floor Type
      4. Lighting conditions
      5. Furniture/Obstacles to preserve.
      Return JSON format: {spaceType, designStyle, currentFloor, lighting, obstacles: string[]}`;

      const response = await callGemini({
        model: "gemini-3-flash-preview",
        contents: { parts: [
          { text: prompt },
          { inlineData: { mimeType: pendingRoomFile.type, data: pureBase64 } }
        ]},
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
      setPendingRoomFile(null); // Analysis complete
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

      const response = await callGemini({
        model: "gemini-3-flash-preview",
        contents: { parts: [
          { text: prompt },
          { inlineData: { mimeType: file.type, data: pureBase64 } }
        ]},
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

      const response = await callGemini({
        model: "gemini-3-flash-preview",
        contents: { parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: pureBase64 } }
        ]},
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
        
        // V4-3Step spec: "宽松校验"，只要 success: true 或 valid: true 即可
        if (!(verifyRes.data.success || verifyRes.data.valid)) {
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

        const aiResponse = await callGemini({
          model: 'gemini-3.1-flash-image-preview',
          contents: { parts: renderParts },
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

      // --- SaaS 3: Consume & Persist ---
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

            // Persist the results to SaaS UserImage table
            for (const result of newResults) {
              await persistResultImage(saas.userId, saas.toolId, result.img);
            }
          }
        } catch (error) {
          console.error("SaaS Consume/Persist Error:", error);
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
    <div className="min-h-screen bg-[#F8F9FD] font-sans text-gray-900 selection:bg-[#5B50FF]/10 flex overflow-x-hidden">
      {/* Sidebar Navigation */}
      <motion.div 
        animate={{ width: isSidebarCollapsed ? 84 : 260 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 h-screen bg-white text-gray-900 z-[70] flex flex-col border-r border-gray-100 shadow-xl overflow-hidden shrink-0"
      >
        <div className="p-6 flex items-center justify-between mb-8 h-20">
          <AnimatePresence mode="wait">
            {!isSidebarCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-[#5B50FF] rounded-lg flex items-center justify-center font-black italic shadow-lg shadow-[#5B50FF]/20 text-sm text-white">F</div>
                <span className="font-black tracking-tighter text-xl italic uppercase text-gray-900">FloorAI</span>
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-900 transition-colors ${isSidebarCollapsed ? 'mx-auto' : ''}`}
          >
            {isSidebarCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {[
            { id: 'images', label: '效果图生成', icon: LayoutGrid },
            { id: 'video', label: '演示视频', icon: VideoIcon },
          ].map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id as any)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group relative ${
                  isActive 
                    ? 'bg-[#5B50FF] text-white shadow-lg shadow-[#5B50FF]/20' 
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'group-hover:text-[#5B50FF]'}`} />
                {!isSidebarCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="font-black text-[11px] uppercase tracking-widest whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
                {isActive && !isSidebarCollapsed && (
                  <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />
                )}
                {isActive && isSidebarCollapsed && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#5B50FF] rounded-l-full" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-gray-100">
           {!isSidebarCollapsed ? (
             <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
               <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5">系统负载：就绪</p>
               <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                 <span className="text-[10px] font-bold text-gray-400 italic">渲染加速卡已挂载</span>
               </div>
             </div>
           ) : (
             <div className="flex justify-center">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
             </div>
           )}
        </div>
      </motion.div>

      {/* Content Wrapper */}
      <motion.div 
        animate={{ paddingLeft: isSidebarCollapsed ? 84 : 260 }}
        className="flex-1 min-w-0"
      >
        {/* SaaS User Bar */}
        {saas.initialized && saas.user && (
          <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-white/80">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-tr from-[#5B50FF] to-[#8B50FF] rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-[#5B50FF]/20">
                  {saas.user.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-black text-gray-900 leading-tight tracking-tight uppercase italic">{saas.user.name}</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{saas.user.enterprise}</p>
                </div>
                <div className="h-8 w-px bg-gray-100 mx-2" />
                <button 
                  onClick={() => setShowGallery(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-[#5B50FF]/5 rounded-xl transition-all group"
                >
                  <Layers className="w-4 h-4 text-gray-400 group-hover:text-[#5B50FF]" />
                  <span className="text-[11px] font-black text-gray-400 group-hover:text-gray-900 uppercase tracking-widest">作品库</span>
                </button>
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

        {/* View Routing */}
        <AnimatePresence mode="wait">
          {currentView === 'images' ? (
            <motion.div 
              key="images"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-7xl mx-auto px-6 py-12 pb-32"
            >
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
              
              <div className="mt-4 space-y-4">
                <button
                  onClick={startRoomAnalysis}
                  disabled={!roomImg || isAnalyzingRoom || !!roomImgBase64}
                  className={`w-full h-12 rounded-2xl font-black uppercase tracking-widest italic shadow-lg transition-all flex items-center justify-center gap-2 ${
                    !roomImg
                      ? 'bg-gray-50 text-gray-300 cursor-not-allowed shadow-none border border-dashed border-gray-200'
                      : isAnalyzingRoom 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                        : roomImgBase64 
                          ? 'bg-green-50 text-green-600 border border-green-100 cursor-default shadow-none'
                          : 'bg-[#5B50FF] text-white shadow-[#5B50FF]/20 hover:bg-[#4A40FF]'
                  }`}
                >
                  {isAnalyzingRoom ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Loader2 className="w-5 h-5" />
                      </motion.div>
                      正在智能解析...
                    </>
                  ) : roomImgBase64 ? (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      解析已完成
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      开始物理语义分析
                    </>
                  )}
                </button>

                {roomImg && roomImgBase64 && !isAnalyzingRoom && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 bg-green-50/30 rounded-xl border border-green-100/50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-black text-green-700 italic uppercase tracking-wider">AI Identification Success</span>
                    </div>
                    <span className="text-[10px] font-bold text-green-600">地面边界已锁定</span>
                  </motion.div>
                )}
              </div>
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
            <div className="flex justify-start pt-4">
              <button 
                onClick={handleGenerate}
                disabled={isGenerating || !roomImg || saas.isVerifying}
                className="h-[52px] px-10 bg-[#0A0D18] rounded-2xl group relative overflow-hidden flex items-center justify-center gap-4 text-white transition-all active:scale-[0.98] hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#5B50FF]/2 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1500ms] cubic-bezier(0.4, 0, 0.2, 1)" />
                <div className="w-8 h-8 bg-[#5B50FF] rounded-xl flex items-center justify-center shadow-[0_4px_16px_rgba(91,80,255,0.3)] group-hover:scale-110 transition-transform flex-shrink-0">
                  {isGenerating || saas.isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                </div>
                <div className="flex flex-col items-start justify-center">
                  <h3 className="text-sm font-black italic tracking-tight uppercase leading-none">
                    {isGenerating ? '正在生成...' : saas.isVerifying ? '正在校验' : '开启全景替换渲染'}
                  </h3>
                  <p className="text-gray-500 text-[8px] font-bold uppercase tracking-widest mt-1 opacity-70">
                    {isGenerating ? 'AI 解析中' : saas.isVerifying ? 'SaaS 授权' : `${angles.length} 个视角准备就绪`}
                  </p>
                </div>
              </button>
            </div>
              
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
            </motion.div>
          ) : (
            <motion.div 
              key="video"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-7xl mx-auto px-6 py-12 pb-32"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left: Configuration */}
                <div className="lg:col-span-4 space-y-6">
                  <Card title="视频生成配置" icon={<VideoIcon className="w-4 h-4 text-[#5B50FF]" />}>
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 block italic">选择参考图 (History)</label>
                        <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                          {history.map((h) => (
                            <button
                              key={h.id}
                              onClick={() => setSelectedVideoSourceId(h.id)}
                              className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${
                                selectedVideoSourceId === h.id ? 'border-[#5B50FF] shadow-lg shadow-[#5B50FF]/20 scale-[0.98]' : 'border-transparent opacity-60 hover:opacity-100'
                              }`}
                            >
                              <img src={h.img} alt="Ref" className="w-full h-full object-cover" />
                              {selectedVideoSourceId === h.id && (
                                <div className="absolute inset-0 bg-[#5B50FF]/20 flex items-center justify-center backdrop-blur-[2px]">
                                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-xl">
                                    <CheckCircle2 className="w-6 h-6 text-[#5B50FF]" />
                                  </div>
                                </div>
                              )}
                            </button>
                          ))}
                          {history.length === 0 && (
                            <div className="col-span-2 py-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl">
                              <ImageIcon className="w-8 h-8 text-gray-200 mb-3" />
                              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">请先在「效果图生成」中创建作品</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block italic">输出分辨率</label>
                          <div className="flex gap-2">
                            {['720p', '1080p'].map(res => (
                              <button
                                key={res}
                                onClick={() => setVideoResolution(res)}
                                className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                  videoResolution === res 
                                    ? 'bg-[#5B50FF] text-white shadow-lg shadow-[#5B50FF]/20' 
                                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                }`}
                              >
                                {res}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block italic">画幅比例</label>
                          <div className="flex gap-2">
                            {['16:9', '9:16', '1:1'].map(ratio => (
                              <button
                                key={ratio}
                                onClick={() => setVideoAspectRatio(ratio)}
                                className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                  videoAspectRatio === ratio 
                                    ? 'bg-[#5B50FF] text-white shadow-lg shadow-[#5B50FF]/20' 
                                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                }`}
                              >
                                {ratio}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleGenerateVideo}
                        disabled={isVideoGenerating || !selectedVideoSourceId}
                        className="w-full h-16 bg-gray-900 text-white rounded-2xl flex items-center justify-center gap-3 font-black italic uppercase text-xs tracking-widest hover:bg-[#0A0D18] transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-xl"
                      >
                        {isVideoGenerating ? (
                          <div className="flex items-center gap-2">
                             <Loader2 className="w-4 h-4 animate-spin text-[#5B50FF]" />
                             <span className="animate-pulse">正在提取图像特征...</span>
                          </div>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-[#5B50FF] group-hover:animate-bounce" />
                            启动视频演练生成
                          </>
                        )}
                      </button>
                    </div>
                  </Card>
                </div>

                {/* Right: Preview Area */}
                <div className="lg:col-span-8">
                  <div className="bg-white rounded-[40px] border border-gray-100 shadow-2xl overflow-hidden aspect-video relative flex flex-col items-center justify-center ring-1 ring-gray-100">
                    <AnimatePresence mode="wait">
                      {videoResult ? (
                        <motion.div
                          key={videoResult}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="w-full h-full relative"
                        >
                          <video
                            src={videoResult}
                            className="w-full h-full object-cover"
                            autoPlay
                            loop
                            muted
                            playsInline
                          />
                          <div className="absolute top-8 right-8 flex gap-4 z-20">
                            <button
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = videoResult;
                                link.target = '_blank';
                                link.download = `floor_render_video_${Date.now()}.mp4`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="h-12 px-6 bg-white/95 backdrop-blur-md rounded-2xl flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-gray-900 shadow-2xl hover:scale-105 active:scale-95 transition-all"
                            >
                              <Download className="w-4 h-4 text-[#5B50FF]" />
                              下载演示视频
                            </button>
                            <button
                              onClick={() => setVideoResult(null)}
                              className="w-12 h-12 bg-white/95 backdrop-blur-md rounded-2xl flex items-center justify-center text-gray-900 shadow-2xl hover:scale-105 active:scale-95 transition-all"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </motion.div>
                      ) : isVideoGenerating ? (
                        <motion.div 
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center gap-8"
                        >
                          <div className="relative">
                            <div className="w-32 h-32 border-8 border-gray-50 rounded-full" />
                            <div className="absolute inset-0 w-32 h-32 border-8 border-t-[#5B50FF] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                            <div className="absolute inset-4 overflow-hidden rounded-full">
                               {selectedVideoSourceId && history.find(h => h.id === selectedVideoSourceId) && (
                                 <img src={history.find(h => h.id === selectedVideoSourceId)?.img} className="w-full h-full object-cover opacity-30 grayscale animate-pulse" />
                               )}
                            </div>
                          </div>
                          <div className="text-center">
                             <p className="text-2xl font-black italic text-gray-900 uppercase tracking-tight">正在构建深度时空帧...</p>
                             <div className="flex items-center justify-center gap-3 mt-3">
                               <div className="flex gap-1">
                                 {[1, 2, 3].map(i => <div key={i} className={`w-1.5 h-1.5 rounded-full bg-[#5B50FF] animate-bounce`} style={{ animationDelay: `${i*0.2}s` }} />)}
                               </div>
                               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em]">GPU CLUSTER: VEO-3.1 ENGINE ACTIVE</p>
                             </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center gap-8 p-12 text-center"
                        >
                           <div className="w-28 h-28 bg-[#5B50FF]/5 rounded-[40px] flex items-center justify-center text-[#5B50FF]">
                             <VideoIcon className="w-12 h-12" />
                           </div>
                           <div>
                             <p className="text-2xl font-black italic text-gray-900 uppercase tracking-tighter">视频演练渲染中心</p>
                             <p className="text-sm font-medium text-gray-400 max-w-sm mt-3 leading-relaxed">
                               基于左侧选定的 4K 效果图，系统将自动分析地板材质反光率并生成动态漫游视频
                             </p>
                           </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="mt-8 flex flex-wrap gap-4">
                    {['1080P Cinema', 'HEVC H.265', 'Raytraced Motion', 'BT.2020 HDR'].map(t => (
                      <div key={t} className="px-6 py-3 bg-white border border-gray-100 rounded-2xl flex items-center gap-3 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#5B50FF]" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-40 text-center border-t border-gray-100 pt-20 pb-20">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">
            <span className="hover:text-[#5B50FF] transition-colors cursor-default">GEMINI 3.5 FLASH</span>
            <span className="hover:text-[#5B50FF] transition-colors cursor-default">VE0-3.1 GENERATE</span>
            <span className="hover:text-[#5B50FF] transition-colors cursor-default">VISION ENGINE V3.1</span>
          </div>
          <p className="text-gray-400 text-[10px] font-bold mt-10 uppercase tracking-widest opacity-50">© 2026 FLOORAI SYSTEM. EMPOWERED BY NEXT-GEN SPATIAL AI.</p>
        </footer>
      </motion.div>

      {/* Overlays */}
      <AnimatePresence>
        {showGallery && saas.userId && (
          <Gallery 
            userId={saas.userId} 
            role={(saas.user as any)?.role || 1} 
            onClose={() => setShowGallery(false)} 
          />
        )}
        {previewImg && <PreviewModal img={previewImg} onClose={() => setPreviewImg(null)} />}
      </AnimatePresence>
    </div>
  );
}
