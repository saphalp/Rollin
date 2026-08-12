import { useCallback, useEffect, useState } from 'react';

import {
  fetchMyActiveOffers,
  fetchMyActiveRequests,
  fetchMyRideHistory,
  MyRideRequestDashboardItem,
  OfferedRideDashboardItem,
  RideHistoryDashboardItem,
  subscribeToRideDashboard,
} from '@/services/ride-dashboard-service';

export function useRideDashboardData(
  historyFilter: 'all' | 'offered' | 'requested',
) {
  const [offeredRides, setOfferedRides] = useState<OfferedRideDashboardItem[]>([]);
  const [myRequests, setMyRequests] = useState<MyRideRequestDashboardItem[]>([]);
  const [history, setHistory] = useState<RideHistoryDashboardItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadRideData = useCallback(async () => {
    setDataError(null);

    try {
      const [offers, requests, historyItems] = await Promise.all([
        fetchMyActiveOffers(),
        fetchMyActiveRequests(),
        fetchMyRideHistory(historyFilter),
      ]);

      setOfferedRides(offers);
      setMyRequests(requests);
      setHistory(historyItems);
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'Could not load ride data.',
      );
    } finally {
      setDataLoading(false);
    }
  }, [historyFilter]);

  useEffect(() => {
    void loadRideData();
    const unsubscribe = subscribeToRideDashboard(() => void loadRideData());
    return unsubscribe;
  }, [loadRideData]);

  return {
    offeredRides,
    myRequests,
    history,
    dataLoading,
    dataError,
    loadRideData,
  };
}
