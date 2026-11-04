import { useCallback, useEffect, useState } from 'react';

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

export function useRideDashboardData(
  historyFilter: 'all' | 'offered' | 'requested',
) {
  const [offeredRides, setOfferedRides] = useState<OfferedRideDashboardItem[]>([]);
  const [othersOffers, setOthersOffers] = useState<RideOffer[]>([]);
  const [myRequests, setMyRequests] = useState<MyRideRequestDashboardItem[]>([]);
  const [incomingSeatRequests, setIncomingSeatRequests] = useState<IncomingSeatRequestDashboardItem[]>([]);
  const [history, setHistory] = useState<RideHistoryDashboardItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadRideData = useCallback(async () => {
    setDataError(null);

    try {
      const [offers, available, requests, incoming, historyItems] = await Promise.all([
        fetchMyActiveOffers(),
        // Open rides with seats, offered by everyone except you, activity or not.
        fetchAvailableRides(),
        fetchMyActiveRequests(),
        fetchIncomingSeatRequests(),
        fetchMyRideHistory(historyFilter),
      ]);

      setOfferedRides(offers);
      setOthersOffers(available);
      setMyRequests(requests);
      setIncomingSeatRequests(incoming);
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
    othersOffers,
    myRequests,
    incomingSeatRequests,
    history,
    dataLoading,
    dataError,
    loadRideData,
  };
}
