import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.util.ArrayDeque;
import java.util.StringTokenizer;

class Solution {
	static int[] ROWS = { 0, 0, -1, 1 };
	static int[] COLS = { -1, 1, 0, 0 };

	static class Status {
		int r;
		int c;
		int memory;
		int dir;

		Status(int r, int c, int memory, int dir) {
			this.r = r;
			this.c = c;
			this.memory = memory;
			this.dir = dir;
		}
	}

	public static void main(String args[]) throws Exception {
		BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
		StringTokenizer st = new StringTokenizer(br.readLine());
		int T;
		T = Integer.parseInt(st.nextToken());

		for (int test_case = 1; test_case <= T; test_case++) {
			st = new StringTokenizer(br.readLine());
			int R = Integer.parseInt(st.nextToken());
			int C = Integer.parseInt(st.nextToken());

			int[][] arr = new int[R][C];
			for (int i = 0; i < R; i++) {
				String a = br.readLine().trim();
				for (int j = 0; j < a.length(); j++) {
					arr[i][j] = a.charAt(j);

				}
			}

			boolean[][][][] visited = new boolean[R][C][16][4];
			boolean endable = false;

			ArrayDeque<Status> q = new ArrayDeque<>();
			q.add(new Status(0, 0, 0, 1));

			while (!q.isEmpty()) {
				Status s = q.pollFirst();

				if (visited[s.r][s.c][s.memory][s.dir])
					continue;

				visited[s.r][s.c][s.memory][s.dir] = true;

				int r = s.r;
				int c = s.c;
				int memory = s.memory;
				int curDir = s.dir;
				boolean isRandom = false;
				if ((char) arr[r][c] == '<') {
					curDir = 0;
				} else if ((char) arr[r][c] == '>') {
					curDir = 1;
				} else if ((char) arr[r][c] == '^') {
					curDir = 2;
				} else if ((char) arr[r][c] == 'v') {
					curDir = 3;
				} else if ((char) arr[r][c] == '_') {
					if (memory == 0) {
						curDir = 1;
					} else {
						curDir = 0;
					}
				} else if ((char) arr[r][c] == '|') {
					if (memory == 0)
						curDir = 3;
					else
						curDir = 2;
				} else if ((char) arr[r][c] == '?') {
					isRandom = true;
				} else if ((char) arr[r][c] == '.') {
				} else if ((char) arr[r][c] == '@') {
					endable = true;
					break;
				} else if ((char) arr[r][c] == '+') {
					if (memory == 15)
						memory = 0;
					else
						memory += 1;
				} else if ((char) arr[r][c] == '-') {
					if (memory == 0)
						memory = 15;
					else
						memory -= 1;
				} else {
					memory = Integer.parseInt(String.valueOf((char) arr[r][c]));
				}

				if (!isRandom) {
					int nextR = r + ROWS[curDir];
					int nextC = c + COLS[curDir];
					if (nextR < 0)
						nextR = R - 1;
					else if (nextR == R)
						nextR = 0;
					else if (nextC < 0)
						nextC = C - 1;
					else if (nextC == C)
						nextC = 0;
					q.addFirst(new Status(nextR, nextC, memory, curDir));
				} else {
					for (int d = 0; d < 4; d++) {
						int nextR = r + ROWS[d];
						int nextC = c + COLS[d];
						if (nextR < 0)
							nextR = R - 1;
						else if (nextR == R)
							nextR = 0;
						else if (nextC < 0)
							nextC = C - 1;
						else if (nextC == C)
							nextC = 0;
						q.addFirst(new Status(nextR, nextC, memory, d));
					}
				}
			}

			if (endable) {
				System.out.printf("#%d %s\n", test_case, "YES");
			} else {
				System.out.printf("#%d %s\n", test_case, "NO");
			}
		}
	}
}
