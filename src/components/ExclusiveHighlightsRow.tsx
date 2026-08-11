import { Crown, Plus, LockKeyhole } from "lucide-react";

export interface ExclusiveRoomHighlight {
  id: string;
  name: string;
  thumbnail_url?: string;
  entry_fee?: number;
  entry_fee_paise?: number;
  has_access?: boolean;
  sort_order?: number;
}

interface ExclusiveHighlightsRowProps {
  rooms: ExclusiveRoomHighlight[];
  onOpenRoom: (room: ExclusiveRoomHighlight) => void;
  /** Creator can add a room when under the 4-room limit */
  canManage?: boolean;
  onAddRoom?: () => void;
  className?: string;
}

/** Instagram-style circular highlights row for Exclusive Rooms. */
export function ExclusiveHighlightsRow({
  rooms,
  onOpenRoom,
  canManage = false,
  onAddRoom,
  className = "",
}: ExclusiveHighlightsRowProps) {
  const showAdd = canManage && rooms.length < 4 && onAddRoom;

  if (!rooms.length && !showAdd) return null;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex gap-4 overflow-x-auto pb-1 px-1 scrollbar-thin">
        {rooms.map((room) => {
          const locked = !canManage && room.has_access === false;
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onOpenRoom(room)}
              className="flex flex-col items-center gap-1.5 shrink-0 w-[76px] group"
            >
              <div className="relative w-[68px] h-[68px] rounded-full p-[2px] bg-gradient-to-tr from-rose-400 via-amber-300 to-rose-500">
                <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100 border-2 border-white flex items-center justify-center">
                  {room.thumbnail_url ? (
                    <img
                      src={room.thumbnail_url}
                      alt=""
                      className={`w-full h-full object-cover ${locked ? "brightness-75" : ""}`}
                    />
                  ) : (
                    <Crown className="w-6 h-6 text-rose-400" />
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center">
                  {locked ? (
                    <LockKeyhole className="w-2.5 h-2.5 text-white" />
                  ) : (
                    <Crown className="w-2.5 h-2.5 text-white" />
                  )}
                </span>
              </div>
              <span className="text-[11px] font-medium text-zinc-800 text-center leading-tight truncate w-full">
                {room.name || "Exclusive"}
              </span>
            </button>
          );
        })}

        {showAdd && (
          <button
            type="button"
            onClick={onAddRoom}
            className="flex flex-col items-center gap-1.5 shrink-0 w-[76px]"
          >
            <div className="w-[68px] h-[68px] rounded-full border-2 border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center text-zinc-400 hover:border-rose-300 hover:text-rose-500 transition-colors">
              <Plus className="w-7 h-7" />
            </div>
            <span className="text-[11px] font-medium text-zinc-500 text-center">New room</span>
          </button>
        )}
      </div>
    </div>
  );
}
