
import React from "react";

interface AgentTypeSelectorProps {
  onSelectAgentType: (agentType: string) => void;
}

const AgentTypeSelector: React.FC<AgentTypeSelectorProps> = ({
  onSelectAgentType,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {/* Main Title */}
      {/* <h1 className="text-4xl font-semibold text-gray-800 mb-8">
        Choose Your Experience
      </h1> */}

      {/* Agent Type Rectangles */}
      <div className="flex gap-8 w-full max-w-2xl">
        {/* Fast Agent */}
        <button
          onClick={() => onSelectAgentType("fast")}
          className="flex-1 h-64 bg-white border-2 border-[#468BFF] rounded-lg hover:bg-[#8FBCFA] transition-all duration-300 shadow-md hover:shadow-lg group"
        >
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="text-4xl font-semibold text-[#468BFF] group-hover:text-[#468BFF] mb-4">
              Hybrid Search 
            </div>
            <p className="text-gray-600 text-center leading-relaxed">
              powered by CosmosDB, OpenAI Enbeddings, Reciprocal Rank Fusion (RRF) and BM25 algorithms
              t
            </p>
          </div>
        </button>

        {/* Deep Agent */}
        <button
          onClick={() => onSelectAgentType("deep")}
          className="flex-1 h-64 bg-white border-2 border-[#468BFF] rounded-lg hover:bg-[#8FBCFA] transition-all duration-300 shadow-md hover:shadow-lg group"
        >
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="text-4xl font-semibold text-[#468BFF] group-hover: mb-4">
              Chart
            </div>
            <p className="text-gray-600 text-center leading-relaxed">
              based on Dynamic RAG, Gengin plugged with Gemini LLM and the tooling arround corporarte GraphQL
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default AgentTypeSelector; 
