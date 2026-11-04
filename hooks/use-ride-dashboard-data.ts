import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchIncomingSeatRequests,
  fetchMyActiveOffers,
  fetchMyActiveRequests,
  fetchMyRideHistory,
  IncomingSeatRequestDashboardItem,
  MyRideRequestDashboardItem,
  OfferedRideDashboardItem,
  RideHistoryDashboardItem,
  subscribeToRideDashboard,
} from '@/services/ride-dashboard-service';
import { fetchAvailableRides } from '@/services/rides-service';
import type { RideOffer } from '@/types/rides';

type HistoryFilter = 'all' | 'offered' | 'requested';

export function useRideDashboardData(historyFilter: HistoryFilter) {
  const [offeredRides, setOfferedRides] = useState<OfferedRideDashboardItem[]>([]);
  const [othersOffers, setOthersOffers] = useState<RideOffer[]>([]);
  const [myRequests, setMyRequests] = useState<MyRideRequestDashboardItem[]>([]);
  const [incomingSeatRequests, setIncomingSeatRequests] = useState<IncomingSeatRequestDashboardItem[]>([]);
  // The filter is stored with its results so the list counts as loading until they match.
  const [historyResult, setHistoryResult] =
    useState<{ filter: HistoryFilter; items: RideHistoryDashboardItem[] } | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Read by realtime refreshes, which shouldn't resubscribe whenever the filter changes.
  const historyFilterRef = useRef(historyFilter);
  const historyRequestId = useRef(0);

  const loadHistory = useCallback(async () => {
    const requestId = ++historyRequestId.current;
    const filter = historyFilterRef.current;

    try {
      const items = await fetchMyRideHistory(filter);
      // Ignore a slower response for a filter the user already switched away from.
      if (requestId === historyRequestId.current) setHistoryResult({ filter, items });
    } catch (error) {
      if (requestId !== historyRequestId.current) return;
      setDataError(error instanceof Error ? error.message : 'Could not load ride history.');
      setHistoryResult({ filter, items: [] });
    }
  }, []);

  const loadActiveData = useCallback(async () => {
    try {
      const [offers, available, requests, incoming] = await Promise.all([
        fetchMyActiveOffers(),
        // Open rides with seats, offered by everyone except you, activity or not.
        fetchAvailableRides(),
        fetchMyActiveRequests(),
        fetchIncomingSeatRequests(),
      ]);

      setOfferedRides(offers);
      setOthersOffers(available);
      setMyRequests(requests);
      setIncomingSeatRequests(incoming);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'Could not load ride data.',
      );
    } finally {
      setDataLoading(false);
    }
  }, []);

  const loadRideData = useCallback(async () => {
    setDataError(null);
    await Promise.all([loadActiveData(), loadHistory()]);
  }, [loadActiveData, loadHistory]);

  // Active tabs: load once and refresh on realtime changes (History refreshes with them).
  useEffect(() => {
    void loadActiveData();
    const unsubscribe = subscribeToRideDashboard(() => {
      void loadActiveData();
      void loadHistory();
    });
    return unsubscribe;
  }, [loadActiveData, loadHistory]);

  // Switching the History filter reloads only the history.
  useEffect(() => {
    historyFilterRef.current = historyFilter;
    void loadHistory();
  }, [historyFilter, loadHistory]);

  return {
    offeredRides,
    othersOffers,
    myRequests,
    incomingSeatRequests,
    history: historyResult?.items ?? [],
    historyLoading: historyResult?.filter !== historyFilter,
    dataLoading,
    dataError,
    loadRideData,
  };
}
