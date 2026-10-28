import React from 'react';
import { Check, Footprints, Bike, Car } from 'lucide-react';
import { RouteGeometryItem, RouteAnalysisResult, TravelMode } from '../types';
import { formatDistance, formatDuration, computeModeDurationSeconds } from '../utils/geoUtils';

interface RouteAlternativeCardProps {
  route: RouteGeometryItem;
  analysis: RouteAnalysisResult;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
  travelMode?: TravelMode;
}

export const RouteAlternativeCard: React.FC<RouteAlternativeCardProps> = ({
  route,
  analysis,
  isSelected,
  onSelect,
  index,
  travelMode = 'driving'
}) => {
  const safetyScore = analysis?.safetyScore ?? 50;

  let safetyLevelLabel = 'High Safety';
  let riskBadgeClass = 'bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30';

  if (analysis?.classification === 'AMBER' || (safetyScore >= 50 && safetyScore < 75)) {
    safetyLevelLabel = 'Moderate Caution';
    riskBadgeClass = 'bg-[#ffb547]/10 text-[#ffb547] border-[#ffb547]/30';
  } else if (analysis?.classification === 'RED' || safetyScore < 50) {
    safetyLevelLabel = 'Elevated Risk';
    riskBadgeClass = 'bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30';
  }

  const modeDurationSecs = computeModeDurationSeconds(route.distanceMeters, travelMode, index);
  const formattedTime = formatDuration(modeDurationSecs);
  const formattedDist = formatDistance(route.distanceMeters);

  const modeIcon =
    travelMode === 'walking' ? (
      <Footprints className="w-3 h-3 text-[#64b5ff] inline mr-1" />
    ) : travelMode === 'biking' ? (
      <Bike className="w-3 h-3 text-[#64b5ff] inline mr-1" />
    ) : (
      <Car className="w-3 h-3 text-[#64b5ff] inline mr-1" />
    );

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-2xl border apple-spring-transition cursor-pointer relative space-y-3 ${
        isSelected
          ? 'animate-spring-select border-[#0a84ff] bg-[#17181c] shadow-xl ring-1 ring-[#0a84ff]/30'
          : 'border-white/10 bg-[#101114] hover:bg-[#17181c] hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3 min-w-0">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${isSelected ? 'border-[#0a84ff] bg-[#0a84ff]' : 'border-white/20'}`}>
            {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-[#f5f5f7] truncate">{route.name}</h3>
            <p className="text-[11px] text-[#a1a1aa] truncate">Via {route.summary}</p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${riskBadgeClass}`}>
          {safetyLevelLabel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-medium text-[#a1a1aa]">
        <div className="bg-[#101114] p-2 rounded-lg border border-white/5">
          Score: <span className="text-[#f5f5f7] font-bold">{safetyScore}/100</span>
        </div>
        <div className="bg-[#101114] p-2 rounded-lg border border-white/5">
          Dist: <span className="text-[#f5f5f7] font-bold">{formattedDist}</span>
        </div>
        <div className="bg-[#101114] p-2 rounded-lg border border-white/5 flex items-center justify-center">
          {modeIcon}
          <span className="text-[#30d158] font-bold">{formattedTime}</span>
        </div>
      </div>
    </div>
  );
};

