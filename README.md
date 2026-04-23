This is a web city-building game inspired by SimCity, but rendered in an isometric view using HTML5. You can build houses, commercial zones, create parks, keep your residents happy, grow your city, and so much more! You can also save your city high scores on a leaderboard. The terrain is procedurally generated with every new map; you can see randomized but realistic lake, mountain, and forest regions. You can place zones with a real-time simulation tick and try to balance residential happiness with taxes, pollution, economy, services, and crime. As you level up zones, the buildings grow taller and contribute more commercial output speed, money, or population. You can build services like police stations to manage crime, stadiums to boost happinness, parks to lessen pollution, and much more. The camera can be panned by dragging, and the map can be rotated 90° at a time. 

I'm most proud of the procedural terrain generation + the isometric renderer. There are five terrain types (water, sand, grass, forest, mountain) with distinct buildability and visuals. Mountain tiles use their noise value to determine their 3D height for natural peaks. Tiles are drawn with painter's algorithm. 

To run locally, open `frontend/index.html` and run `backend/app.py` after flask is installed. There are no secrets. The backend uses a local SQLite file `backend/city_data.db` which is created automatically on first run. 

## Gameplay Controls

| Action | Control |
|---|---|
| Place zone / road | Left-click or drag |
| Level up a tile | Right-click |
| Pan camera | Ctrl + drag |
| Rotate map 90° | `[` / `]` keys or toolbar buttons |
| Pause / unpause | Space |
| Fast-forward | F |
| New map | R or New Map button |

### Zone Groups 

Click a tab to expand it, then select a tool:

- **Zones** — Residential, Commercial, Industrial, Road, Erase
- **Parks** — Park, Small Park
- **Safety** — Fire Station, Police Station, Hospital
- **Culture** — School, Library, Stadium
- **Power** — Power Plant, Solar Farm, Wind Turbine


