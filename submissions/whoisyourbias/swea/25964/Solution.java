import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.BitSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.PriorityQueue;
import java.util.StringTokenizer;

class UserSolution {
		int L;
		int N;
		int M;

		class Slot {
			String mCarNo;
			String no;
			int xx;
			String y;
			int mTime;

			Slot(int mTime, String mCarNo) {
				this.mTime = mTime;
				this.mCarNo = mCarNo;
				this.no = mCarNo.substring(3);
				this.xx = Integer.parseInt(mCarNo.substring(0, 2));
				this.y = mCarNo.substring(2, 3);
			}
		}

		class ExtendedSlot extends Slot {
			boolean gyunin;
			int areaNumber;
			int bitIndex;

			ExtendedSlot(int mTime, String mCarNo, int areaNumber, int bitIndex) {
				super(mTime, mCarNo);
				this.gyunin = false;
				this.areaNumber = areaNumber;
				this.bitIndex = bitIndex;
			}

			@Override
			public String toString() {
				return String.format("%s %d %d %d %b", mCarNo, areaNumber, bitIndex, mTime, gyunin);
			}
		}

		class ParkArea {
			int areaNumber;

			int parkedCnt;

			// 빈공간정보
			BitSet bs;

			ParkArea(int areaNumber) {
				this.areaNumber = areaNumber;
				this.parkedCnt = 0;
				this.bs = new BitSet(M);
			}
		}

		class ParkSite {
			// ① 빈 슬롯이 가장 많은 구역 중 영역의 대문자 순서가 가장 앞선 구역이 선택된다.
			// ② 선택된 구역에서 숫자 번호가 가장 앞선 빈 슬롯에 차량이 보관이 된다.
			// ③ 만약 어느 구역에도 빈 슬롯이 없는 경우 주차는 실패한다
			ParkArea[] m;

			ParkSite(int N, int M, int L) {
				m = new ParkArea[N];
				for (int i = 0; i < N; i++) {
					m[i] = new ParkArea(i);
				}
			}

			@Override
			public String toString() {
				StringBuilder sb = new StringBuilder();
				for (int i = 0; i < N; i++) {
					sb.append(String.format("area: %d pk: %d\n", m[i].areaNumber, m[i].parkedCnt));
				}
				return sb.toString();
			}
		}

		ParkSite ps;
		ArrayList<ExtendedSlot> gps;
		HashMap<String, ExtendedSlot> carNoToESlot;
		HashMap<String, ExtendedSlot> towing;
		HashMap<String, PriorityQueue<ExtendedSlot>> noToTrset;
		HashSet<ExtendedSlot> deleted;

		public void init(int N, int M, int L) {
			this.N = N;
			this.M = M;
			this.L = L;
			ps = new ParkSite(N, M, L);
			gps = new ArrayList<>();
			carNoToESlot = new HashMap<>();
			towing = new HashMap<>();
			deleted = new HashSet<>();
			noToTrset = new HashMap<>();
			return;
		}

		public Solution.RESULT_E enter(int mTime, String mCarNo) {
			Solution.RESULT_E res_e = new Solution.RESULT_E();

			remove(mTime);

			// 1. 빈 슬롯이 가장 많은 구역 중 대문자 순서가 가장 앞선 구역 선택
			Arrays.sort(ps.m, (a, b) -> {
				if (a.parkedCnt == b.parkedCnt)
					return a.areaNumber - b.areaNumber;
				return a.parkedCnt - b.parkedCnt;
			});

			if (towing.get(mCarNo) != null) {
				if (noToTrset.get(mCarNo.substring(3)) != null) {
					noToTrset.get(mCarNo.substring(3)).remove(towing.get(mCarNo));
				}
				towing.remove(mCarNo);
			}

			if (carNoToESlot.get(mCarNo) != null) {
				res_e.success = 0;
				return res_e;
			}

			if (ps.m[0].parkedCnt == M) {
				res_e.success = 0;
				return res_e;
			}

			// false인 첫 비트 찾기
			int available = ps.m[0].bs.nextClearBit(0);

			int areaNumber = ps.m[0].areaNumber;
			// 전역관리공간에 넣기
			ExtendedSlot entered = new ExtendedSlot(mTime, mCarNo, areaNumber, available);

			// 빈공간이 가장 많은 구역에서 주차할 자리가 없으면 -1
			if (available >= M) {
				res_e.success = 0;
			} else {
				// 성공
				res_e.success = 1;
				// 구역번호

				gps.add(entered);
				ps.m[0].parkedCnt++;
				ps.m[0].bs.set(available, true);

				carNoToESlot.put(mCarNo, entered);
				res_e.locname = getParkedLocation(areaNumber, available);
				noToTrset.putIfAbsent(entered.no, new PriorityQueue<>(
						(ExtendedSlot a, ExtendedSlot b) -> {
							if (a.gyunin != b.gyunin) {
								if (a.gyunin == false)
									return -1;
								else
									return 1;
							} else {
								if (a.xx == b.xx) {
									return a.y.compareTo(b.y);
								} else {
									return a.xx - b.xx;
								}
							}
						}));
				noToTrset.get(entered.no).add(entered);
			}

			return res_e;
		}

		public int pullout(int mTime, String mCarNo) {
			remove(mTime);
			if (carNoToESlot.containsKey(mCarNo)) {

				ExtendedSlot carToRemove = carNoToESlot.get(mCarNo);

				// lazy deletion
				deleted.add(carToRemove);

				for (int i = 0; i < ps.m.length; i++) {
					if (ps.m[i].areaNumber != carToRemove.areaNumber)
						continue;
					ps.m[i].parkedCnt--;
					ps.m[i].bs.set(carToRemove.bitIndex, false);
					break;
				}
				carNoToESlot.remove(mCarNo);
				noToTrset.get(carToRemove.no).remove(carToRemove);

				return mTime - carToRemove.mTime;
			} else if (towing.containsKey(mCarNo)) {
				ExtendedSlot es = towing.get(mCarNo);
				towing.remove(mCarNo);
				noToTrset.get(es.no).remove(es);
				// 주차기간 = L
				// 견인된 기간: 현재시간 - (L + 들어온시간)
				return (L + (mTime - (es.mTime + L)) * 5) * -1;
			}

			return -1;
		}

		public Solution.RESULT_S search(int mTime, String mStr) {
			Solution.RESULT_S res_s = new Solution.RESULT_S();

			remove(mTime);

			PriorityQueue<ExtendedSlot> s = noToTrset.get(mStr);

			if (s == null || s.size() == 0) {
				res_s.cnt = 0;
				return res_s;
			}

			PriorityQueue<ExtendedSlot> tmp = new PriorityQueue<>(
					(ExtendedSlot a, ExtendedSlot b) -> {
						if (a.gyunin == b.gyunin) {
							if (a.xx == b.xx) {
								return a.y.compareTo(b.y);
							} else {
								return a.xx - b.xx;
							}
						} else {
							if (a.gyunin == false)
								return 1;
							else
								return -1;
						}
					});
			int sSize = s.size();
			int c = 0;
			for (int i = 0; (i < sSize && c < 5); i++) {
				ExtendedSlot es = s.poll();
				res_s.carlist[c++] = es.mCarNo;
				tmp.add(es);
			}
			while (!tmp.isEmpty())
				s.add(tmp.poll());
			res_s.cnt = c;
			return res_s;
		}

		private void remove(int mTime) {
			while (!gps.isEmpty() && gps.get(0).mTime + L <= mTime) {
				ExtendedSlot p = gps.remove(0);

				// 견인되어야하는 차들.
				if (deleted.remove(p)) {
					continue;
				}

				p.gyunin = true;
				// 견인위치
				towing.put(p.mCarNo, p);

				// 주차공간에서도 삭제
				carNoToESlot.remove(p.mCarNo);

				// 뺏다가 다시 넣기
				noToTrset.get(p.no).remove(p);
				noToTrset.get(p.no).add(p);

				for (ParkArea pa : ps.m) {
					if (pa.areaNumber != p.areaNumber)
						continue;
					pa.bs.set(p.bitIndex, false);
					pa.parkedCnt--;
					break;
				}
			}
		}

		public String getParkedLocation(int areaNumber, int available) {
			StringBuilder bs = new StringBuilder();
			bs.append((char) ('A' + areaNumber));
			bs.append(String.format("%03d", available));
			return bs.toString();
		}
	}