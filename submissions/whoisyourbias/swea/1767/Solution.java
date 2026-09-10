import java.util.ArrayList;
import java.util.Collections;
import java.util.StringTokenizer;
import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStreamReader;

class Solution
{
	static final int[] ROWS = {0,1,0,-1};
	static final int[] COLS = {1,0,-1,0};
	static int[][] map;
	static boolean[][] visited;
	static int N;
	static int len;
	static int connectedCore;
	static int alreadyConnected;
	static ArrayList<lv> lst;
	static class lv {
		int len;
		int connected;
		lv(int len, int connected) {this.len=len; this.connected=connected;}
	}
	public static void main(String args[]) throws Exception
	{
		BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
		StringTokenizer st = new StringTokenizer(br.readLine());
		int T;
		T=Integer.parseInt(st.nextToken());

		for(int test_case = 1; test_case <= T; test_case++)
		{
			st = new StringTokenizer(br.readLine());
			N = Integer.parseInt(st.nextToken());

			map = new int[N][N];
			visited = new boolean[N][N];
			len = 0;
			connectedCore = 0;
			alreadyConnected = 0;
			lst = new ArrayList<>();
			for (int i = 0; i  < N; i++) {
				st = new StringTokenizer(br.readLine());
				
				for (int j = 0;  j < N; j++) {
					map[i][j] = Integer.parseInt(st.nextToken());
				}
			}

			for (int i = 0; i < N; i++) {
				for (int j = 0; j < N; j++) {
					if (map[i][j] != 0) {
						if (i == 0 || j == 0 || i == N -1 || j == N-1)
							alreadyConnected++;
					}
				}
			}

			int c = alreadyConnected + 1;
			for (int i = 1; i < N - 1; i++) {
				for (int j = 1; j < N - 1; j++) {
					if (map[i][j] == 1) {
						map[i][j] = c++;
					}
				}
			}

			connectedCore = alreadyConnected;
			dfs(0,0, alreadyConnected + 1, c);
			Collections.sort(lst, (a,b) -> {
				if (b.connected == a.connected) {
					return a.len - b.len;
				}

				return b.connected - a.connected;

			} );
            if (lst.size() != 0)
				System.out.printf("#%d %d\n", test_case, lst.get(0).len);
			else
				System.out.printf("#%d %d\n", test_case, 0);

		}
	}

	private static void dfs(int r, int c, int targetCore, int max) {

		
		if (targetCore == max) {
			lst.add(new lv(len,connectedCore));
			return;
		}
		for (int i = 1; i < N-1; i++) {
			for (int j =1; j < N-1; j++) {
				if (map[i][j] == targetCore) {
					for (int d = 0; d < 4; d++) {
						boolean collaped = fill(i, j, d);
						if (!collaped) {
							dfs(i,j,targetCore+1, max);
                        }	
                        remove(i,j,d);
					}
                    dfs(i,j,targetCore+1, max);
                    
					return;
				}
			}
		}


	}

	private static boolean fill(int i, int j, int d) {
		visited[i][j] = true;

		int v = map[i][j];

		int nextr = i + ROWS[d];
		int nextc = j + COLS[d];

		while (true) {
			// 충돌
			if (visited[nextr][nextc] == true) {
				return true;
			}

			// 코어가 다른게 있누?
			if (map[nextr][nextc] != 0) {
				return true;
			}

			visited[nextr][nextc] = true;
			map[nextr][nextc] = v;
			len++;
			// 충돌없이 끝도달.
			if (nextr == 0 || nextc == 0 || nextr == N - 1|| nextc == N - 1) {
				// add connected
				connectedCore++;
				return false;
			}


			nextr = nextr + ROWS[d];
			nextc = nextc + COLS[d];
		}
	}

	private static void remove(int i, int j, int d) {
		visited[i][j] = false;

		int v = map[i][j];
		int nextr = i + ROWS[d];
		int nextc = j + COLS[d];

		while (true) {
			if (map[nextr][nextc] != v) {
				break;
			}


			if (visited[nextr][nextc] != true) {
				break;
			}


			
			visited[nextr][nextc] = false;
			map[nextr][nextc] = 0;
			len--;

			// 충돌없이 끝도달.
			if (nextr == 0 || nextc == 0 || nextr == N - 1|| nextc == N - 1) {
				// add connected
				connectedCore--;
				break;
			}

			nextr = nextr + ROWS[d];
			nextc = nextc + COLS[d];
		}
	}
}
