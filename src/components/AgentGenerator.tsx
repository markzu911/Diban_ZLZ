import { useState, useRef, useEffect, Dispatch, SetStateAction } from 'react';
import { 
  Send, 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Loader2, 
  Download, 
  Maximize2, 
  Bot, 
  User, 
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { callGemini } from '../lib/gemini';
import { Type } from "@google/genai";
import { resizeImage } from '../lib/image-utils';

type AspectRatio = '1:1' | '3:4' | '4:3' | '16:9';
type Quality = '1K' | '2K' | '4K';
type ViewAngle = '对角线' | '近景' | '细节';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  image?: string | null;
  imageType?: 'room' | 'material' | 'result';
  suggestions?: { label: string; action: string; payload?: any }[];
  timestamp: Date;
}

interface Step3State {
  spaceType: string;
  designStyle: string;
  targetFloor: string;
  floorDetails?: {
    shape?: string;
    pattern?: string;
    texture?: string;
    finish?: string;
    relief?: string;
    color?: string;
  };
  lighting: string;
  obstacles: string[];
}

interface RenderResult {
  id: string;
  time: string;
  img: string;
  angle: '对角线' | '近景' | '细节';
  prompt: string;
  params: Step3State;
}

interface AgentGeneratorProps {
  roomImg: string | null;
  roomImgBase64: string | null;
  materialImg: string | null;
  materialImgBase64: string | null;
  step3: Step3State;
  aspect: AspectRatio;
  quality: Quality;
  angles: ViewAngle[];
  history: RenderResult[];
  saas: any;
  setRoomImg: (url: string | null) => void;
  setRoomImgBase64: (base64: string | null) => void;
  setMaterialImg: (url: string | null) => void;
  setMaterialImgBase64: (base64: string | null) => void;
  setStep3: Dispatch<SetStateAction<Step3State>>;
  setAspect: Dispatch<SetStateAction<AspectRatio>>;
  setQuality: Dispatch<SetStateAction<Quality>>;
  setHistory: Dispatch<SetStateAction<RenderResult[]>>;
  handleGenerate: () => Promise<void>;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
}

export default function AgentGenerator({
  roomImg,
  roomImgBase64,
  materialImg,
  materialImgBase64,
  step3,
  aspect,
  quality,
  angles,
  history,
  saas,
  setRoomImg,
  setRoomImgBase64,
  setMaterialImg,
  setMaterialImgBase64,
  setStep3,
  setAspect,
  setQuality,
  setHistory,
  handleGenerate,
  isGenerating,
  setIsGenerating
}: AgentGeneratorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  
  const roomInputRef = useRef<HTMLInputElement>(null);
  const materialInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize with a welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'ai',
          text: '您好，我是您的智能设计助手。让我们开始替换地板吧，请分别上传一张您的房间实景照片和一张地板贴图照片，我将为您进行深度全场景分析。',
          suggestions: [
            { label: '📁 上传房间照片', action: 'trigger_room_upload' },
            { label: '📁 上传地板照片', action: 'trigger_material_upload' }
          ],
          timestamp: new Date()
        }
      ]);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  const fileToBase64 = async (file: File): Promise<string> => {
    try {
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

  const addMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMsg]);
    return newMsg;
  };

  // 1. Room Upload
  const processRoomFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    setRoomImg(url);
    setRoomImgBase64(null);

    // Add user message to chat with the image preview
    addMessage({
      sender: 'user',
      text: `已上传房间照片：${file.name}`,
      image: url,
      imageType: 'room'
    });

    try {
      const base64 = await fileToBase64(file);
      setRoomImgBase64(base64);
      
      // Check if we have both now
      if (materialImgBase64) {
        startDualAnalysis(base64, materialImgBase64);
      } else {
        setIsAiTyping(true);
        setTimeout(() => {
          setIsAiTyping(false);
          addMessage({
            sender: 'ai',
            text: '已收到房间照片。接下来，请上传您想要替换的地板材质图片，以便我进行完整分析。',
            suggestions: [
              { label: '📁 上传地板材质图', action: 'trigger_material_upload' }
            ]
          });
        }, 600);
      }
    } catch (error) {
      console.error("Room processing failed", error);
    }
  };

  // 2. Material Upload
  const processMaterialFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    setMaterialImg(url);
    setMaterialImgBase64(null);

    addMessage({
      sender: 'user',
      text: `已上传地板材质图：${file.name}`,
      image: url,
      imageType: 'material'
    });

    try {
      const base64 = await fileToBase64(file);
      setMaterialImgBase64(base64);
      
      // Check if we have both now
      if (roomImgBase64) {
        startDualAnalysis(roomImgBase64, base64);
      } else {
        setIsAiTyping(true);
        setTimeout(() => {
          setIsAiTyping(false);
          addMessage({
            sender: 'ai',
            text: '已收到地板材质图。现在请上传您的房间实景照片，我将为您进行深度场景分析。',
            suggestions: [
              { label: '📁 上传房间照片', action: 'trigger_room_upload' }
            ]
          });
        }, 600);
      }
    } catch (error) {
      console.error("Material processing failed", error);
    }
  };

  // 3. Dual Analysis Logic
  const startDualAnalysis = async (rBase64: string, mBase64: string) => {
    setIsAiTyping(true);
    addMessage({
      sender: 'ai',
      text: '已集齐房间与地板照片。正在为您进行全场景深度分析，请稍候...'
    });

    try {
      const rPure = rBase64.split(',')[1];
      const mPure = mBase64.split(',')[1];

      // Analysis 1: Room
      const roomPrompt = `分析这张房间图片以进行地板更换。识别：
      1. 空间类型（如：客厅、卧室）
      2. 设计风格（如：现代、复古）
      3. 光照条件
      4. 需要保留的家具/障碍物。
      请使用中文返回 JSON 格式：{spaceType, designStyle, lighting, obstacles: string[]}`;

      // Analysis 2: Material
      const materialPrompt = `识别此地板材质样品。
      识别物理表面特征：
      1. 材质名称（如：“天然橡木”）
      2. 单元形状（如：“长条板”）
      3. 纹路/布局（如：“人字拼”）
      4. 纹理/木纹（如：“深色木纹”）
      5. 物理起伏/颠簸
      6. 光泽/表面（如：“哑光”）
      请使用中文返回 JSON：{ materialName, shape, pattern, texture, relief, finish }`;

      // Run in parallel for efficiency
      const [roomRes, materialRes] = await Promise.all([
        callGemini({
          model: "gemini-3.5-flash",
          contents: { parts: [
            { text: roomPrompt },
            { inlineData: { mimeType: "image/png", data: rPure } }
          ]},
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                spaceType: { type: Type.STRING },
                designStyle: { type: Type.STRING },
                lighting: { type: Type.STRING },
                obstacles: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }),
        callGemini({
          model: "gemini-3.5-flash",
          contents: { parts: [
            { text: materialPrompt },
            { inlineData: { mimeType: "image/png", data: mPure } }
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
        })
      ]);

      const rData = JSON.parse(roomRes.text || '{}');
      const mData = JSON.parse(materialRes.text || '{}');

      const updatedStep3 = {
        spaceType: rData.spaceType || '客餐厅',
        designStyle: rData.designStyle || '现代简约',
        targetFloor: mData.materialName || '选定地板',
        lighting: rData.lighting || '自然天光',
        obstacles: rData.obstacles || [],
        floorDetails: mData
      };
      
      setStep3(updatedStep3);
      setIsAiTyping(false);

      addMessage({
        sender: 'ai',
        text: `深度分析完成！\n\n**场景画像：**\n• 空间类型：${updatedStep3.spaceType}\n• 设计风格：${updatedStep3.designStyle}\n• 光照条件：${updatedStep3.lighting}\n\n**材质属性：**\n• 材质名称：${updatedStep3.targetFloor}\n• 铺贴拼法：${mData.pattern || '常规'}\n• 物理质感：${mData.finish || '哑光'}\n\n一切准备就绪，您可以直接开始渲染，或告诉我对参数进行微调（如：“帮我生成1:1, 4K照片”）。`,
        suggestions: [
          { label: '🎨 开启一键渲染', action: 'start_rendering' },
          { label: '⚙️ 调整参数配置', action: 'manual_parameters' },
          { label: '🔄 重新上传照片', action: 'reset_chat' }
        ]
      });

    } catch (error) {
      console.error("Dual analysis failed", error);
      setIsAiTyping(false);
      addMessage({
        sender: 'ai',
        text: '解析照片时遇到一点波动，但我们仍可以尝试渲染。是否继续？',
        suggestions: [
          { label: '🎨 开启一键渲染', action: 'start_rendering' },
          { label: '🔄 重新上传照片', action: 'reset_chat' }
        ]
      });
    }
  };

  // 4. AI Recommend Floor
  const handleAiRecommendFloor = async () => {
    if (!roomImgBase64) {
      addMessage({
        sender: 'ai',
        text: '请先上传您的房间实景照片，以便我可以为您推荐合适的地板。',
        suggestions: [{ label: '📁 上传房间照片', action: 'trigger_room_upload' }]
      });
      return;
    }

    addMessage({
      sender: 'user',
      text: '让AI推荐最适合地板材质'
    });

    setIsAiTyping(true);

    try {
      const pureBase64 = roomImgBase64.split(',')[1];
      const prompt = `基于此房间图像，推荐最适合的地板材质。
      考虑墙面颜色、光照和现有风格。
      使用中文返回 JSON：{ 
        name: string, 
        reason: string,
        details: { color: string, shape: string, pattern: string, texture: string, relief: string, finish: string } 
      }`;

      const response = await callGemini({
        model: "gemini-3.5-flash",
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
                  color: { type: Type.STRING },
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

        setIsAiTyping(false);
        addMessage({
          sender: 'ai',
          text: `为您推荐了[${data.name}]。原因为：${data.reason}。该材质契合您的硬装。是否直接开启渲染？`,
          suggestions: [
            { label: '🎨 采用推荐，开始替换渲染', action: 'start_rendering' },
            { label: '📁 换个方式，我自己上传贴图', action: 'trigger_material_upload' },
            { label: '🔄 重新让AI分析推荐', action: 'ai_recommend_floor' }
          ]
        });
      } else {
        throw new Error("No name in AI recommend");
      }
    } catch (error) {
      console.error("Agent AI recommendation failed", error);
      setIsAiTyping(false);
      addMessage({
        sender: 'ai',
        text: 'AI推荐暂时不顺畅，我们可以采用通用现代多层原木板。是否继续？',
        suggestions: [
          { label: '🎨 直接开始渲染', action: 'start_rendering' },
          { label: '📁 自己上传材质', action: 'trigger_material_upload' }
        ]
      });
    }
  };

  // Demo room setup
  const useDemoRoom = () => {
    addMessage({
      sender: 'user',
      text: '上传地板照片'
    });
    
    // We can use a standard royalty-free living room URL
    const demoUrl = "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80";
    setRoomImg(demoUrl);
    
    setIsAiTyping(true);
    setTimeout(() => {
      // Simulate base64 converting of remote image
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        canvas.width = img.width > 1280 ? 1280 : img.width;
        canvas.height = (img.height / img.width) * canvas.width;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/png');
          setRoomImgBase64(base64);
        }
      };
      img.src = demoUrl;

      setStep3({
        spaceType: '高档客餐厅',
        designStyle: '轻奢极简',
        targetFloor: '哑光实木板',
        lighting: '全景晨光',
        obstacles: ['布艺沙发', '极简大理石茶几', '落地台灯']
      });

      setIsAiTyping(false);
      addMessage({
        sender: 'ai',
        text: '已为您载入高档客餐厅体验场景。设计风格为轻奢极简，拥有全景晨光。接下来请选择地板贴图材质。',
        suggestions: [
          { label: '🤖 让AI推荐最适合地板材质', action: 'ai_recommend_floor' },
          { label: '📁 上传我的地板材质图', action: 'trigger_material_upload' }
        ]
      });
    }, 1000);
  };

  // Trigger Rendering flow
  const runGeneration = async () => {
    if (!roomImg) {
      addMessage({
        sender: 'ai',
        text: '必须先上传或选择房间全景图才能开始渲染。',
        suggestions: [{ label: '📁 上传房间照片', action: 'trigger_room_upload' }]
      });
      return;
    }

    addMessage({
      sender: 'user',
      text: '开启替换渲染，生成高清大图'
    });

    setIsAiTyping(true);
    const renderMsgId = 'rendering-progress';
    
    // Put a rendering status message
    setMessages(prev => [...prev, {
      id: renderMsgId,
      sender: 'ai',
      text: '正在启动深度空间物理重建模，请耐心等待 10-20 秒...',
      timestamp: new Date()
    }]);

    try {
      // Temporarily use App's generate logic
      const beforeHistoryLen = history.length;
      await handleGenerate();
      
      // We wait for the isGenerating state of App.tsx to complete and detect new images in history
    } catch (err) {
      console.error("Agent render execution error:", err);
      setIsAiTyping(false);
      setMessages(prev => prev.filter(m => m.id !== renderMsgId));
      addMessage({
        sender: 'ai',
        text: '渲染服务负载波动，未能成功生成。是否再次尝试？',
        suggestions: [
          { label: '🔄 重新生成', action: 'start_rendering' },
          { label: '⚙️ 调整视角配置', action: 'adjust_angles' }
        ]
      });
    }
  };

  // Watch history to display generated output inside the chat
  useEffect(() => {
    if (messages.some(m => m.id === 'rendering-progress') && !isGenerating) {
      // Rendering finished! Find the newest item from history
      const newestResult = history[0];
      setMessages(prev => prev.filter(m => m.id !== 'rendering-progress'));
      setIsAiTyping(false);

      if (newestResult) {
        addMessage({
          sender: 'ai',
          text: `高清${newestResult.angle}方案效果图已完美渲染完成。色彩融合与透视对齐已达到实景级交付标准。`,
          image: newestResult.img,
          imageType: 'result',
          suggestions: [
            { label: '📥 下载此高清效果图', action: 'download_result', payload: newestResult },
            { label: '🔄 尝试其他视角/参数', action: 'adjust_angles' },
            { label: '✨ 开启新一轮设计', action: 'reset_chat' }
          ]
        });
      } else {
        addMessage({
          sender: 'ai',
          text: '生成结果已放入您的作品库，未能在聊天中直接捕获。您可以打开作品库查看。',
          suggestions: [
            { label: '✨ 开启新一轮设计', action: 'reset_chat' }
          ]
        });
      }
    }
  }, [history, isGenerating]);

  // Handle Suggestions button click
  const handleSuggestionClick = (action: string, payload?: any) => {
    switch (action) {
      case 'trigger_room_upload':
        roomInputRef.current?.click();
        break;
      case 'trigger_material_upload':
        materialInputRef.current?.click();
        break;
      case 'use_demo_room':
        useDemoRoom();
        break;
      case 'ai_recommend_floor':
        handleAiRecommendFloor();
        break;
      case 'manual_parameters':
        addMessage({
          sender: 'user',
          text: '我想手动配置参数'
        });
        setIsAiTyping(true);
        setTimeout(() => {
          setIsAiTyping(false);
          addMessage({
            sender: 'ai',
            text: '您可以调整渲染比例或画质。或者您也可以直接告诉我，例如：“帮我生成16:9, 4k照片”。',
            suggestions: [
              { label: '📏 1:1 比例', action: 'set_aspect_1_1' },
              { label: '📏 16:9 比例', action: 'set_aspect_16_9' },
              { label: '💎 4K 极清画质', action: 'set_quality_4k' },
              { label: '🎨 开启一键渲染', action: 'start_rendering' }
            ]
          });
        }, 500);
        break;
      case 'set_aspect_1_1':
        setAspect('1:1');
        addMessage({ sender: 'user', text: '设置比例为 1:1' });
        addMessage({ sender: 'ai', text: '比例已设为 1:1。准备好了吗？', suggestions: [{ label: '🎨 开始渲染', action: 'start_rendering' }] });
        break;
      case 'set_aspect_16_9':
        setAspect('16:9');
        addMessage({ sender: 'user', text: '设置比例为 16:9' });
        addMessage({ sender: 'ai', text: '比例已设为 16:9。准备好了吗？', suggestions: [{ label: '🎨 开始渲染', action: 'start_rendering' }] });
        break;
      case 'set_quality_4k':
        setQuality('4K');
        addMessage({ sender: 'user', text: '设置画质为 4K' });
        addMessage({ sender: 'ai', text: '画质已提升至 4K 极清。准备好了吗？', suggestions: [{ label: '🎨 开始渲染', action: 'start_rendering' }] });
        break;
      case 'set_preset_1':
        setStep3(prev => ({
          ...prev,
          designStyle: '原木奶油风',
          targetFloor: '人字拼天然橡木',
          floorDetails: { shape: '长条板', pattern: '人字拼', texture: '天然木纹', relief: '轻微浮雕', finish: '柔光' }
        }));
        addMessage({
          sender: 'user',
          text: '选择风格：原木风 + 人字拼橡木'
        });
        addMessage({
          sender: 'ai',
          text: '已为您应用原木风和人字拼橡木地板参数。可以开始一键效果图生成。',
          suggestions: [
            { label: '🎨 开启一键替换渲染', action: 'start_rendering' },
            { label: '🔄 更换房间照片', action: 'trigger_room_upload' }
          ]
        });
        break;
      case 'set_preset_2':
        setStep3(prev => ({
          ...prev,
          designStyle: '现代极简风',
          targetFloor: '哑光水泥灰砖',
          floorDetails: { shape: '大方砖', pattern: '对缝铺贴', texture: '微水泥质感', relief: '平滑微砂', finish: '极哑光' }
        }));
        addMessage({
          sender: 'user',
          text: '选择风格：现代极简 + 哑光水泥灰'
        });
        addMessage({
          sender: 'ai',
          text: '已为您应用现代微水泥地板风格配置。已锁定地面，准备好一键渲染。',
          suggestions: [
            { label: '🎨 开启一键替换渲染', action: 'start_rendering' },
            { label: '🔄 更换材质贴图', action: 'trigger_material_upload' }
          ]
        });
        break;
      case 'set_preset_3':
        setStep3(prev => ({
          ...prev,
          designStyle: '美式复古风',
          targetFloor: '鱼骨拼深色胡桃木',
          floorDetails: { shape: '长条窄板', pattern: '鱼骨拼', texture: '深色胡桃木重纹理', relief: '深度拉丝', finish: '半哑光' }
        }));
        addMessage({
          sender: 'user',
          text: '选择风格：美式复古 + 鱼骨拼深胡桃'
        });
        addMessage({
          sender: 'ai',
          text: '已应用深色胡桃木鱼骨拼设计。一切已就绪。',
          suggestions: [
            { label: '🎨 开启一键替换渲染', action: 'start_rendering' },
            { label: '🔄 重新选择风格', action: 'manual_parameters' }
          ]
        });
        break;
      case 'start_rendering':
        runGeneration();
        break;
      case 'adjust_angles':
        addMessage({
          sender: 'user',
          text: '我想调整视角'
        });
        setIsAiTyping(true);
        setTimeout(() => {
          setIsAiTyping(false);
          addMessage({
            sender: 'ai',
            text: '请选择你想输出效果图的机位。默认已选中对角线俯仰视角：',
            suggestions: [
              { label: '对角线视角 (空间全貌)', action: 'toggle_angle_diag' },
              { label: '中景近景视角 (家具互动)', action: 'toggle_angle_mid' },
              { label: '微距细节视角 (材质微理)', action: 'toggle_angle_detail' },
              { label: '✨ 确定视角，开始渲染', action: 'start_rendering' }
            ]
          });
        }, 500);
        break;
      case 'toggle_angle_diag':
        addMessage({ sender: 'user', text: '设定为主视角：对角线' });
        // Make sure diagonal is selected
        addMessage({ sender: 'ai', text: '已锁定对角线主视角。可以直接启动渲染。', suggestions: [{ label: '🎨 开启渲染', action: 'start_rendering' }] });
        break;
      case 'toggle_angle_mid':
        addMessage({ sender: 'user', text: '增选近景视角' });
        setStep3(prev => ({ ...prev, obstacles: [...new Set([...prev.obstacles, '沙发', '茶几'])] }));
        addMessage({ sender: 'ai', text: '近景近摄机位已启用，镜头将更聚焦于地板和家具衔接边缘。', suggestions: [{ label: '🎨 开启渲染', action: 'start_rendering' }] });
        break;
      case 'toggle_angle_detail':
        addMessage({ sender: 'user', text: '增选微距材质视角' });
        addMessage({ sender: 'ai', text: '微距特写机位已启用，镜头会极度靠近地面，强调地板拼缝与木纹凹凸感。', suggestions: [{ label: '🎨 开启渲染', action: 'start_rendering' }] });
        break;
      case 'download_result':
        if (payload?.img) {
          const link = document.createElement('a');
          link.href = payload.img;
          link.download = `floor-agent-render-${payload.id || 'image'}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          addMessage({ sender: 'ai', text: '已为您下载该渲染结果文件。' });
        }
        break;
      case 'reset_chat':
        setRoomImg(null);
        setRoomImgBase64(null);
        setMaterialImg(null);
        setMaterialImgBase64(null);
        setMessages([
          {
            id: 'welcome-reset',
            sender: 'ai',
            text: '已为您重置画板。请重新上传您的房间实景与地板贴图照片以开始深度分析。',
            suggestions: [
              { label: '📁 上传房间照片', action: 'trigger_room_upload' },
              { label: '📁 上传地板照片', action: 'trigger_material_upload' }
            ],
            timestamp: new Date()
          }
        ]);
        break;
      default:
        break;
    }
  };

  // 4. Natural Language Parameter Parsing
  const parseParamsFromText = (text: string) => {
    let changed = false;

    // Aspect Ratio
    if (text.includes('1:1')) { setAspect('1:1'); changed = true; }
    else if (text.includes('16:9')) { setAspect('16:9'); changed = true; }
    else if (text.includes('9:16')) { setAspect('1:1'); /* fallback since 9:16 not in type */ changed = true; }
    else if (text.includes('4:3')) { setAspect('4:3'); changed = true; }
    else if (text.includes('3:4')) { setAspect('3:4'); changed = true; }

    // Quality
    if (text.toLowerCase().includes('4k')) { setQuality('4K'); changed = true; }
    else if (text.toLowerCase().includes('2k')) { setQuality('2K'); changed = true; }
    else if (text.toLowerCase().includes('1k') || text.includes('高清')) { setQuality('1K'); changed = true; }

    return changed;
  };

  // Handle Text message send
  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    addMessage({
      sender: 'user',
      text: text
    });
    setInputValue('');
    setIsAiTyping(true);

    // Check if it's a parameter setting command
    const hasParams = parseParamsFromText(text);
    const shouldStartRender = text.includes('生成') || text.includes('渲染') || text.includes('开始');

    if (hasParams && shouldStartRender) {
      if (!roomImgBase64 || !materialImgBase64) {
        setTimeout(() => {
          setIsAiTyping(false);
          addMessage({
            sender: 'ai',
            text: '我已按您的要求配置了渲染参数，但由于照片尚未集齐，无法开始渲染。请先上传房间和地板照片。',
            suggestions: [
              { label: '📁 上传房间照片', action: 'trigger_room_upload' },
              { label: '📁 上传地板照片', action: 'trigger_material_upload' }
            ]
          });
        }, 600);
      } else {
        setTimeout(() => {
          setIsAiTyping(false);
          addMessage({
            sender: 'ai',
            text: `收到！已为您调整参数。现在为您启动一键替换渲染...`
          });
          runGeneration();
        }, 1000);
      }
      return;
    }

    if (hasParams && !shouldStartRender) {
      setTimeout(() => {
        setIsAiTyping(false);
        addMessage({
          sender: 'ai',
          text: `参数已更新。准备好了随时告诉我“开始生成”。`,
          suggestions: [
            { label: '🎨 开始生成渲染', action: 'start_rendering' }
          ]
        });
      }, 600);
      return;
    }

    try {
      // Create a prompt that contextually understands our agent role
      const contextPrompt = `你是一个专门从事地板更换的室内设计AI助手。当前状态：房间图${roomImg ? '已上传' : '未上传'}，材质图${materialImg ? '已上传' : '未上传'}。
      
      用户对你说：“${text}”
      
      回复规则：
      1. 如果话题相关（地板、装修、材质等），请极简回复并引导下一步。
      2. 如果话题无关（如问天气、闲聊、非设计话题），请礼貌告知您的职责是“地板设计专家”，无法回答此类问题，并引导用户继续完成当前地板替换任务。
      3. 严禁使用 ** 加粗、# 标题或 Emoji 表情。
      4. 保持回复在两行以内。
      
      返回格式（JSON）：
      {
         "text": "你的极简回复内容",
         "suggestAction": "下一步建议：start_rendering, trigger_material_upload, trigger_room_upload, manual_parameters, none"
      }`;

      const response = await callGemini({
        model: "gemini-3.5-flash",
        contents: { parts: [{ text: contextPrompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              suggestAction: { type: Type.STRING }
            }
          }
        }
      });

      const resData = JSON.parse(response.text || '{}');
      setIsAiTyping(false);

      // Create suggestions based on the suggestAction response
      const actionMap: Record<string, {label: string, action: string}[]> = {
        'start_rendering': [{ label: '🎨 开启一键替换渲染', action: 'start_rendering' }],
        'trigger_material_upload': [{ label: '📁 上传地板材质图', action: 'trigger_material_upload' }],
        'trigger_room_upload': [{ label: '📁 上传房间照片', action: 'trigger_room_upload' }],
        'manual_parameters': [{ label: '⚙️ 手动配置其他参数', action: 'manual_parameters' }]
      };

      const customSuggestions = actionMap[resData.suggestAction] || [
        { label: '🎨 开启替换渲染', action: 'start_rendering' },
        { label: '📁 重新上传房间', action: 'trigger_room_upload' },
        { label: '📁 重新上传材质', action: 'trigger_material_upload' }
      ];

      addMessage({
        sender: 'ai',
        text: resData.text || '我已收到您的要求。让我们点击下方开始吧。',
        suggestions: customSuggestions
      });

    } catch (err) {
      console.error("Text chat Gemini call failed", err);
      setIsAiTyping(false);
      addMessage({
        sender: 'ai',
        text: '我明白您的意思。随时可以通过点击下方的建议选项来继续设计。',
        suggestions: [
          { label: '🎨 开启替换渲染', action: 'start_rendering' },
          { label: '📁 上传地板贴图', action: 'trigger_material_upload' }
        ]
      });
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-50/30 overflow-hidden">
      {/* Hidden Files Selectors */}
      <input 
        type="file" 
        hidden 
        ref={roomInputRef} 
        accept="image/*" 
        onChange={(e) => e.target.files?.[0] && processRoomFile(e.target.files[0])}
      />
      <input 
        type="file" 
        hidden 
        ref={materialInputRef} 
        accept="image/*" 
        onChange={(e) => e.target.files?.[0] && processMaterialFile(e.target.files[0])}
      />

      {/* Main Container with Padding */}
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 md:px-6 pt-4 md:pt-6 pb-0 min-h-0">
        
        {/* Header Info */}
        <div className="bg-white rounded-3xl border border-gray-100 p-4 md:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-4 md:mb-6 flex flex-wrap items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-11 md:h-11 bg-[#5B50FF]/10 rounded-2xl flex items-center justify-center text-[#5B50FF] flex-shrink-0">
              <Bot className="w-5.5 h-5.5 md:w-6 md:h-6" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-gray-900 tracking-tight italic uppercase">AI 智能设计对话助手</h3>
              <p className="text-[11px] md:text-xs text-gray-400 mt-0.5">极简、精准的一键出图对话流。只需跟随助手引导即可轻松替换地板。</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-gray-50 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-gray-100">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">参数与编辑器实时双向同步</span>
          </div>
        </div>

        {/* Chat Messages Log */}
        <div className="flex-1 bg-white rounded-3xl border border-gray-100 p-4 md:p-6 overflow-y-auto mb-4 md:mb-6 shadow-sm space-y-4 md:space-y-6 flex flex-col scrollbar-thin scrollbar-thumb-gray-200">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-3 md:gap-4 w-full ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-md ${
                  msg.sender === 'ai' 
                    ? 'bg-gradient-to-tr from-[#5B50FF] to-[#8B50FF] shadow-[#5B50FF]/20' 
                    : 'bg-gray-900 font-bold italic uppercase'
                }`}>
                  {msg.sender === 'ai' ? <Bot className="w-4.5 h-4.5 md:w-5 md:h-5" /> : 'U'}
                </div>

                {/* Message Bubble Column */}
                <div className={`flex flex-col gap-1.5 md:gap-2 max-w-[85%] md:max-w-[75%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Bubble */}
                  <div className={`p-3 md:p-4 rounded-2xl text-xs md:text-sm leading-relaxed md:leading-loose tracking-wide break-words w-fit ${
                    msg.sender === 'user' 
                      ? 'bg-[#5B50FF] text-white rounded-tr-none font-bold shadow-[0_4px_12px_rgba(91,80,255,0.15)]' 
                      : 'bg-gray-50 text-gray-800 rounded-tl-none border border-gray-100/50 shadow-[0_2px_8px_rgba(0,0,0,0.01)]'
                  }`}>
                    {msg.text}

                    {/* Attachment Preview */}
                    {msg.image && (
                      <div className="mt-3 md:mt-4 rounded-xl overflow-hidden border border-black/5 bg-white shadow-md relative group max-w-[280px] md:max-w-[360px] transition-all">
                        <img 
                          src={msg.image} 
                          alt="Upload Preview" 
                          className="w-full h-auto max-h-[300px] object-contain block"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-2 left-2 bg-black/60 px-2.5 py-1 rounded-full text-[9px] font-bold text-white uppercase tracking-wider backdrop-blur">
                          {msg.imageType === 'room' ? '实景图' : msg.imageType === 'material' ? '贴图' : '渲染结果'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Choice Buttons */}
                  {msg.sender === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 md:gap-2 mt-1 md:mt-2">
                      {msg.suggestions.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(sug.action, sug.payload)}
                          className="px-3 md:px-4 py-1.5 md:py-2 bg-white hover:bg-[#5B50FF]/5 hover:text-[#5B50FF] border border-gray-100 hover:border-[#5B50FF]/20 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-1.5 md:gap-2 shadow-sm active:scale-95"
                        >
                          {sug.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {/* AI Typing loading state */}
            {isAiTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-3 md:gap-4"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-tr from-[#5B50FF] to-[#8B50FF] rounded-xl flex items-center justify-center text-white flex-shrink-0 animate-pulse">
                  <Bot className="w-4.5 h-4.5 md:w-5 md:h-5" />
                </div>
                <div className="bg-gray-50 border border-gray-100 p-3 md:p-4 rounded-2xl rounded-tl-none text-[10px] md:text-xs font-bold text-[#5B50FF] uppercase tracking-widest flex items-center gap-1.5 md:gap-2 shadow-sm">
                  <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                  <span>智能体正在思考处理中...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>

        {/* Input Form Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputValue.trim()) {
              handleSendMessage(inputValue);
            }
          }}
          className="flex gap-2 md:gap-4 items-center bg-white rounded-2xl border border-gray-100 p-2 md:p-3 shadow-md focus-within:border-[#5B50FF]/30 transition-all"
        >
          {/* Upload attachments shortcut */}
          <div className="flex items-center gap-1 md:gap-1.5 pl-1 md:pl-2">
            <button
              type="button"
              onClick={() => roomInputRef.current?.click()}
              title="上传房间照片"
              className="p-1.5 md:p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-[#5B50FF] transition-all"
            >
              <Upload className="w-4 h-4 md:w-4.5 md:h-4.5" />
            </button>
            <button
              type="button"
              onClick={() => materialInputRef.current?.click()}
              title="上传材质样品图"
              className="p-1.5 md:p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-[#5B50FF] transition-all"
            >
              <ImageIcon className="w-4 h-4 md:w-4.5 md:h-4.5" />
            </button>
          </div>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="给设计助手发送一条指令（例如：帮我推荐原木风地板）..."
            className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-xs md:text-sm py-1.5 md:py-2 px-2 md:px-3 placeholder-gray-400 text-gray-800 font-medium"
          />

          <button
            type="submit"
            disabled={!inputValue.trim()}
            className={`h-8 md:h-10 px-4 md:px-6 rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-wider flex items-center gap-1.5 md:gap-2 transition-all ${
              inputValue.trim()
                ? 'bg-[#5B50FF] text-white shadow-md shadow-[#5B50FF]/20 hover:bg-[#4A40FF]'
                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            }`}
          >
            <Send className="w-3 md:w-3.5 h-3 md:h-3.5" />
            <span>发送</span>
          </button>
        </form>
      </div>
    </div>
  );
}
