import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AgentWithBalances, Block } from "@/lib/agentsApi";

function dotIcon(color: string, size: number, selected: boolean) {
  const ring = selected
    ? "box-shadow:0 0 0 2px #201D1D, 0 0 0 4px #ffffff;"
    : "box-shadow:0 0 0 3px rgba(0,0,0,0.25);";
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #201D1D;${ring}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const NORMAL_ICON = dotIcon("#A1FF62", 14, false);
const WARNING_ICON = dotIcon("#ef4444", 18, false);
const NORMAL_SELECTED_ICON = dotIcon("#A1FF62", 14, true);
const WARNING_SELECTED_ICON = dotIcon("#ef4444", 18, true);

function DeselectOnMapClick({ onDeselect }: { onDeselect: () => void }) {
  useMapEvents({
    click: () => onDeselect(),
  });
  return null;
}

export function AgentMap({
  block,
  agents,
  alertedAgentIds,
  selectedAgentId,
  onSelect,
}: {
  block: Block;
  agents: AgentWithBalances[];
  alertedAgentIds: Set<string>;
  selectedAgentId: string | null;
  onSelect: (agentId: string | null) => void;
}) {
  return (
    <MapContainer
      center={[block.centerLat, block.centerLng]}
      zoom={13}
      scrollWheelZoom
      className="h-[28rem] w-full rounded-lg border border-border/60"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <DeselectOnMapClick onDeselect={() => onSelect(null)} />
      {agents.map((agent) => {
        const isSelected = agent.id === selectedAgentId;
        const isAlerted = alertedAgentIds.has(agent.id);
        const icon = isAlerted
          ? isSelected
            ? WARNING_SELECTED_ICON
            : WARNING_ICON
          : isSelected
            ? NORMAL_SELECTED_ICON
            : NORMAL_ICON;

        return (
          <Marker
            key={agent.id}
            position={[agent.lat, agent.lng]}
            icon={icon}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onSelect(selectedAgentId === agent.id ? null : agent.id);
              },
            }}
          >
            <Popup>
              {agent.name}
              {isAlerted ? " — has an open alert" : ""}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
