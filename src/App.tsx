import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { FlightLayer } from '@/components/fly';
import { TabBar } from '@/components/TabBar';
import { Toaster } from '@/components/toast';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { getSetting, setSetting, useSetting } from '@/data/settings';
import { setHapticsEnabled } from '@/lib/haptics';
import { AskScreen } from '@/features/ask/AskScreen';
import { CheckScreen } from '@/features/check/CheckScreen';
import { LogDetailScreen } from '@/features/log/LogDetailScreen';
import { LogScreen } from '@/features/log/LogScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { SuggestScreen } from '@/features/suggest/SuggestScreen';
import { AddItemScreen } from '@/features/wardrobe/AddItemScreen';
import { EditItemScreen } from '@/features/wardrobe/EditItemScreen';
import { ItemSheet } from '@/features/wardrobe/ItemSheet';
import { WardrobeScreen } from '@/features/wardrobe/WardrobeScreen';

function useAppEffects() {
  const [reduce] = useSetting('ui.reduceMotion');
  const [haptics] = useSetting('ui.haptics');
  useEffect(() => { document.documentElement.dataset.reduceMotion = String(reduce); }, [reduce]);
  useEffect(() => setHapticsEnabled(haptics), [haptics]);
  useEffect(() => {
    // Ask the browser once to keep the wardrobe safe from automatic storage clean-up.
    (async () => {
      if ((await getSetting('storage.persisted')) !== null || !navigator.storage?.persist) return;
      const already = (await navigator.storage.persisted?.()) ?? false;
      await setSetting('storage.persisted', already || (await navigator.storage.persist()));
    })().catch(() => undefined);
  }, []);
  return reduce;
}

export default function App() {
  const location = useLocation();
  const reduce = useAppEffects();
  const fullScreen = /^\/wardrobe\/(add|edit)/.test(location.pathname);
  return (
    <MotionConfig reducedMotion={reduce ? 'always' : 'user'} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
      <div className="mx-auto min-h-dvh max-w-xl bg-bg">
        <UpdatePrompt />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={fullScreen ? 'min-h-dvh' : 'min-h-dvh pb-[calc(5.5rem+env(safe-area-inset-bottom))]'}
          >
            <Routes location={location}>
              <Route path="/wardrobe" element={<WardrobeScreen />} />
              <Route path="/wardrobe/add" element={<AddItemScreen />} />
              <Route path="/wardrobe/edit/:id" element={<EditItemScreen />} />
              <Route path="/ask" element={<AskScreen />} />
              <Route path="/suggest" element={<SuggestScreen />} />
              <Route path="/check" element={<CheckScreen />} />
              <Route path="/log" element={<LogScreen />} />
              <Route path="/log/:id" element={<LogDetailScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="*" element={<Navigate to="/ask" replace />} />
            </Routes>
          </motion.main>
        </AnimatePresence>
        {!fullScreen && <TabBar />}
        <ItemSheet />
        <Toaster />
        <FlightLayer />
      </div>
    </MotionConfig>
  );
}
