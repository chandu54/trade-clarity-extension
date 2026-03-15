import { useState } from "react";
import Modal from "./Modal";
import TrashIcon from "./icons/TrashIcon";
import { useConfirm } from "./ConfirmContext";
import { useToast } from "./ToastContext";

export default function ManageWatchlistsModal({ data, setData, isOpen, onClose }) {
  const [newName, setNewName] = useState("");
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  const watchlists = data.watchlists || [];

  function handleAdd() {
    if (!newName.trim()) return;
    const id = "wl_" + Date.now();
    const newWatchlist = {
      id,
      name: newName.trim(),
      isDefault: false, // Default is All Stocks unless specified
      visibleParams: Object.keys(data.paramDefinitions),
      visibleFilters: Object.keys(data.paramDefinitions).filter(k => data.paramDefinitions[k].filterable),
    };

    const newData = { ...data, watchlists: [...watchlists, newWatchlist] };
    setData(newData);
    setNewName("");
    showToast("Watchlist created", "success");
  }

  async function handleDelete(id) {
    if (!(await confirm("Are you sure you want to delete this watchlist? This will not delete the stocks within it."))) return;

    const newData = {
      ...data,
      watchlists: watchlists.filter((w) => w.id !== id),
    };

    // Remove from stocks as well
    Object.keys(newData.weeks).forEach(country => {
       Object.keys(newData.weeks[country]).forEach(weekKey => {
         const stocks = newData.weeks[country][weekKey].stocks;
         Object.values(stocks).forEach(stock => {
           if (stock.watchlists && stock.watchlists.includes(id)) {
              stock.watchlists = stock.watchlists.filter(wlId => wlId !== id);
           }
         });
       });
    });

    setData(newData);
    showToast("Watchlist deleted", "success");
  }

  function handleRename(id, newNameVal) {
    const newData = {
      ...data,
      watchlists: watchlists.map(w => w.id === id ? { ...w, name: newNameVal } : w)
    };
    setData(newData);
  }

  function handleSetDefault(id) {
    const newData = {
      ...data,
      watchlists: watchlists.map(w => ({ ...w, isDefault: w.id === id }))
    };
    setData(newData);
    if (id === 'all') {
      showToast("All Stocks set as default", "success");
    } else {
      const name = watchlists.find(w => w.id === id)?.name;
      showToast(`${name} set as default`, "success");
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Watchlists" subtitle="Create and manage custom watchlists">
      <div className="manage-params-modal">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            className="input-control flex-1"
            placeholder="New Watchlist Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={handleAdd}>Add</button>
        </div>

        <div className="filter-config-list mt-4">
           {/* All Stocks Option */}
           <div className="filter-config-row">
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <input 
                      type="radio" 
                      name="defaultWatchlist" 
                      checked={!watchlists.some(w => w.isDefault)} 
                      onChange={() => handleSetDefault('all')}
                      title="Set All Stocks as Default"
                    />
                    <span style={{ fontWeight: 600 }}>All Stocks (System Default)</span>
                 </div>
            </div>

           {watchlists.map(w => (
               <div key={w.id} className="filter-config-row">
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <input 
                      type="radio" 
                      name="defaultWatchlist" 
                      checked={!!w.isDefault} 
                      onChange={() => handleSetDefault(w.id)}
                      title="Set as Default Watchlist"
                    />
                    <input 
                      type="text" 
                      className="input-control" 
                      value={w.name} 
                      onChange={(e) => handleRename(w.id, e.target.value)}
                      style={{ padding: '4px 8px', width: '100%', maxWidth: '200px' }}
                    />
                 </div>
                 <button className="ghost-danger-btn" onClick={() => handleDelete(w.id)} title="Delete Watchlist" style={{ padding: '4px' }}>
                    <TrashIcon />
                 </button>
               </div>
           ))}
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn-outline" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
