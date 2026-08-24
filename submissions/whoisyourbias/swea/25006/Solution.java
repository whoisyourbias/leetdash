import java.util.Arrays;
import java.util.HashMap;
import java.util.PriorityQueue;
import java.util.Scanner;



class UserSolution {
	class Node {
		int ID;
		int cost;

		Node(int ID, int cost) {
			this.ID = ID;
			this.cost = cost;
		}

		@Override
		public String toString() {
			return "{" + ID + ":" + cost + "}";
		}
	}

	// road
	class Edge {
		int mid;
		Node from;
		Node to;
		int distance;

		Edge(int mid, Node from, Node to, int distance) {
			this.mid = mid;
			this.from = from;
			this.to = to;
			this.distance = distance;
		}

		Edge(Edge e) {
			this.mid = e.mid;
			this.from = e.from;
			this.to = e.to;
			this.distance = e.distance;
		}

		@Override
		public String toString() {
			return "[" + from.toString() + "|" + to.toString() + "|" + distance + "]";
		}
	}

		class EdgeWithMinCost extends Edge implements Comparable<EdgeWithMinCost> {
			int totalCost;
			int minCost;

			EdgeWithMinCost(int minCost, int totalCost, Edge e) {
				super(e);
				this.minCost = minCost;
				this.totalCost = totalCost;
			}

			EdgeWithMinCost(Edge e) {
				super(e);
				this.minCost = e.from.cost;
			}

			public int getChargeCost() {
				return minCost * this.distance;
			}

			@Override
			public int compareTo(EdgeWithMinCost o) {
				return Integer.compare(this.totalCost, o.totalCost);
			}

			@Override
			public String toString() {
				return super.toString() + "minCost: " + this.minCost;
			}
		}



	Edge[][] graph;
	int[] mCost;
	int N;

	// mid -> [x,y]
	HashMap<Integer, Integer[]> midPosMap;

	public void init(int N, int mCost[], int K, int mId[], int sCity[], int eCity[], int mDistance[]) {
		this.graph = new Edge[N][N];
		this.mCost = mCost;
		this.N = N;
		this.midPosMap = new HashMap<>();
		// init roads(graph)
		for (int i = 0; i < K; i++) {
			// i번째 도로의 출발도시, 도착도시
			int fromCityID = sCity[i];
			int fromCityCost = mCost[fromCityID];
			int toCityID = eCity[i];
			int toCityCost = mCost[toCityID];
			this.midPosMap.put(mId[i], new Integer[] { fromCityID, toCityID });
			Edge road = new Edge(
					mId[i],
					new Node(fromCityID, fromCityCost),
					new Node(toCityID, toCityCost),
					mDistance[i]);

			graph[fromCityID][toCityID] = road;
		}

		return;
	}

	public void add(int mId, int sCity, int eCity, int mDistance) {
		Edge road = new Edge(mId,
				new Node(sCity, this.mCost[sCity]),
				new Node(eCity, this.mCost[eCity]),
				mDistance);
		graph[sCity][eCity] = road;

		this.midPosMap.put(mId, new Integer[] { sCity, eCity });
		return;
	}

	public void remove(int mId) {
		// graph에서 제거.
		Integer[] pos = midPosMap.get(mId);
		this.graph[pos[0]][pos[1]] = null;
		this.midPosMap.remove(mId);
		return;
	}

	public int cost(int sCity, int eCity) {
					// idea 1: 각 노드에서 최단경로는 해당 노드로 가는 indegree경로 중 최소임.
			// 비용은 일반적인 그래프에서는 distance이나, 여기선 distance * 시작 node의 cost 로 비용을 계산해서 최소비용으로
			// 이동하는 다익스트라 알고리즘 사용.

			// chageCost[도시][지금까지의 최소 충전단가]
			int[][] chargeCost = new int[N][2001];

			// 다익스트라는 각 지점으로부터 최소를 찾아야하므로 Integer.MAX_VALUE 최대값으로 초기값세팅
			for (int i = 0; i < N; i++) {
				Arrays.fill(chargeCost[i], Integer.MAX_VALUE);
			}

			// 시작상태:
			// sCity에 있고, 지금까지 가장 싼 충전소는 sCity
			chargeCost[sCity][mCost[sCity]] = 0;

			PriorityQueue<EdgeWithMinCost> q = new PriorityQueue<>();

			// graph의 from 노드에서 outdegree로 나가는 edge모두 추가
			for (int i = 0; i < N; i++) {
				if (graph[sCity][i] != null) {
					Edge e = graph[sCity][i];

					int totalCost = mCost[sCity] * e.distance;
					int minCost = Math.min(mCost[sCity], e.to.cost);
					q.add(new EdgeWithMinCost(minCost, totalCost, graph[sCity][i]));
				}
			}

			while (!q.isEmpty()) {
				EdgeWithMinCost cur = q.poll();

				int curCity = cur.to.ID;

				// 이미 더 좋은 상태가 있는 경우 처리 건너뜀.
				if (cur.totalCost > chargeCost[curCity][cur.minCost])
					continue;

				if (curCity == eCity)
					return cur.totalCost;

				// 경로업데이트.
				for (int next = 0; next < N; next++) {
					// 현재 도시의 outdegree
					Edge nextEdge = graph[curCity][next];

					if (nextEdge == null)
						continue;

					int nextTotalCost = cur.totalCost +
							cur.minCost * nextEdge.distance;

					int nextMinCost = Math.min(cur.minCost, nextEdge.to.cost);

					// 이 경로가 더 좋군요
					if (nextTotalCost < chargeCost[next][nextMinCost]) {
						chargeCost[next][nextMinCost] = nextTotalCost;

						q.add(
								new EdgeWithMinCost(
										nextMinCost,
										nextTotalCost,
										nextEdge));
					}
				}
			}
			return -1;

	}

}