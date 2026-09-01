import java.util.ArrayDeque;
import java.util.PriorityQueue;
import java.util.Scanner;
import java.util.StringTokenizer;
import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStreamReader;

class Solution
{
	static class Pos {
		int x;
		int y;
		Pos(int x, int y) {this.x=x;this.y=y;}
	}

	static class PosWithID extends Pos {
		int id;
		PosWithID(int x, int y, int id) {
			super(x,y);
			this.id = id;
		}
	}

	static class Edge {
		PosWithID pwi1;
		PosWithID pwi2;
		double cost;
		Edge(PosWithID pwi1, PosWithID pwi2) {
			this.pwi1 = pwi1; this.pwi2= pwi2; 
			this.cost = (getDistance(pwi1, pwi2));
		}

		// @Override
		// public String toString() {
		// 	return cost + " " + "[" + pwi1.x + "," + pwi1.y + "|" + pwi2.x +"," + pwi2.y +"]";
		// }
	}

	static int[] parent;
	static double cost;
	static double E;
	public static void main(String args[]) throws Exception
	{
		BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

		StringTokenizer st = new StringTokenizer(br.readLine());
		int T;
		T=Integer.parseInt(st.nextToken());

		for(int test_case = 1; test_case <= T; test_case++)
		{
			st = new StringTokenizer(br.readLine());
			int N = Integer.parseInt(st.nextToken());
		
			int[] xs = new int[N];
			int[] xy = new int[N];
			parent = new int[N];
			cost = 0;

			for (int i = 0; i < N; i++)
				parent[i] = i;
			st = new StringTokenizer(br.readLine());
			for (int i = 0 ; i < N ; i++) {
				xs[i] = Integer.parseInt(st.nextToken());
			}
			st = new StringTokenizer(br.readLine());
			for (int i = 0 ; i < N ; i++) {
				xy[i] = Integer.parseInt(st.nextToken());
			}

			st = new StringTokenizer(br.readLine());
			E = Double.parseDouble(st.nextToken());

			// 각 노드간 간선 전부 넣는 큐
			PriorityQueue<Edge> pq = new PriorityQueue<>(
				(Edge a, Edge b) -> {
					return (int) (a.cost - b.cost);
				}
			);
			for (int i = 0; i < N; i++) {
				PosWithID pwi = new PosWithID(xs[i], xy[i], i);
				for (int j = 0; j < N; j++) {
					if (i == j)
						continue;
					PosWithID pwi2 = new PosWithID(xs[j], xy[j], j);
					pq.add(new Edge(pwi, pwi2));
				}
			}
		
			while (pq.size() > 0) {
				Edge e = pq.poll();
				if (!union(e.pwi1.id, e.pwi2.id)) {
					continue;
				} else {
					cost += e.cost;
				}
			}
			System.out.printf("#%d %d\n", test_case, Math.round(E*cost));
		}
	}

	private static double getDistance(Pos a, Pos b) {
		long xd = Math.abs(a.x-b.x);
		long yd = Math.abs(a.y-b.y);
		return (xd*xd + yd*yd);
	}

	private static int getParent(int x) {
		if (parent[x] == x)
			return x;

		return parent[x] = getParent(parent[x]);
	}

	private static boolean union(int a, int b) {
		// a의 대표
		int pa = getParent(a);
		// b의 대표
		int pb = getParent(b);

		if (pa == pb) {
			// cycle
			return false;
		}

		// 두 대표를 하나의 값으로 합침.
		parent[pa] = Math.min(pa, pb);
		parent[pb] = Math.min(pa, pb);
		return true;
	}
}
