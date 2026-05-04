import { useEffect, useState, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';
import { X, Info, Share2, Database } from 'lucide-react';

interface GraphNode {
  id: string;
  name: string;
  type: string;
  metadata: any;
  val?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
}

interface KnowledgeGraphProps {
  onClose: () => void;
}

export function KnowledgeGraph({ onClose }: KnowledgeGraphProps) {
  const [data, setData] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const fgRef = useRef<any>();

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await axios.get('http://localhost:8000/graph/data');
        setData(res.data);
      } catch (err) {
        console.error("Failed to fetch graph data:", err);
      }
    };
    fetchGraph();
    const interval = setInterval(fetchGraph, 5000);
    return () => clearInterval(interval);
  }, []);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'agent': return '#3b82f6'; // Blue
      case 'file': return '#10b981';  // Green
      case 'concept': return '#a855f7'; // Purple
      case 'task': return '#f59e0b';   // Amber
      default: return '#6b7280';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8 font-['NeoDunggeunmo']">
      <div className="relative w-full h-full bg-[#f3f4f6] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="bg-white border-b-4 border-black p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-white">
                <Share2 size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-black tracking-tight">Gem Knowledge Graph</h2>
                <p className="text-xs text-gray-500">에이전트들의 집단 지성 연결망 (Obsidian + Memento)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-red-400 border-2 border-black hover:bg-red-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
          >
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Graph Area */}
          <div className="flex-1 relative bg-white border-r-4 border-black">
             <ForceGraph2D
                ref={fgRef}
                graphData={data}
                nodeLabel="name"
                nodeColor={node => getNodeColor((node as GraphNode).type)}
                nodeRelSize={8}
                linkDirectionalArrowLength={6}
                linkDirectionalArrowRelPos={1}
                onNodeClick={(node) => setSelectedNode(node as GraphNode)}
                backgroundColor="#ffffff"
                linkColor={() => '#000000'}
                linkWidth={2}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                  const label = node.name;
                  const fontSize = 12 / globalScale;
                  ctx.font = `${fontSize}px NeoDunggeunmo`;
                  const textWidth = ctx.measureText(label).width;
                  const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.5);

                  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                  ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2 + 10, bckgDimensions[0], bckgDimensions[1]);

                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = '#000000';
                  ctx.fillText(label, node.x, node.y + 10);

                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
                  ctx.fillStyle = getNodeColor(node.type);
                  ctx.fill();
                  ctx.strokeStyle = '#000';
                  ctx.lineWidth = 1;
                  ctx.stroke();
                }}
              />
              
              <div className="absolute bottom-4 left-4 bg-white/80 border-2 border-black p-2 text-[10px] flex flex-col gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-500 border border-black rounded-full" /> 에이전트</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 border border-black rounded-full" /> 산출물 (파일)</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 bg-purple-500 border border-black rounded-full" /> 개념/지식</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 bg-amber-500 border border-black rounded-full" /> 태스크</div>
              </div>
          </div>

          {/* Details Sidebar */}
          <aside className="w-80 bg-gray-100 p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            {selectedNode ? (
              <>
                <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <Info size={18} />
                    <span className="font-bold uppercase text-xs">Node Information</span>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{selectedNode.name}</h3>
                  <div className="inline-block px-2 py-0.5 bg-black text-white text-[10px] mb-4">
                    {selectedNode.type.toUpperCase()}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] font-bold text-gray-500 uppercase border-b border-gray-300 mb-1">Metadata</h4>
                      <pre className="text-[10px] bg-gray-50 p-2 border border-gray-200 overflow-x-auto">
                        {JSON.stringify(selectedNode.metadata, null, 2)}
                      </pre>
                    </div>
                    {selectedNode.type === 'file' && (
                       <a 
                        href={`http://localhost:8000/outputs/${selectedNode.name}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none mt-4"
                      >
                        <Database size={16} /> 원본 파일 보기
                      </a>
                    )}
                  </div>
                </div>
                
                <div className="text-[10px] text-gray-400 italic text-center mt-auto">
                  이 노드는 에이전트에 의해 관찰된 지식의 파편입니다.
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center gap-4">
                <Share2 size={48} className="opacity-20" />
                <p>그래프의 노드를 클릭하여<br/>상세 지식 정보를 확인하세요.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
