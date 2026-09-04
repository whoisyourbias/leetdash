import java.util.ArrayDeque;
import java.util.Scanner;
import java.io.FileInputStream;

class Solution
{
	static final int[] ROWS = {0,0,1,-1};
	static final int[] COLS = {-1,1,0,0};
	static class bfs {
		int r;
		int c;
		int d;
		int cnt;
		bfs(int r, int c, int d, int cnt) {
			this.r=r;
			this.c=c;
			this.d=d;
			this.cnt=cnt;
		}
	}

	public static void main(String args[]) throws Exception
	{

		Scanner sc = new Scanner(System.in);
		int T;
		T=sc.nextInt();

		for(int test_case = 1; test_case <= T; test_case++)
		{
			int X1 = sc.nextInt();
			int Y1 = sc.nextInt();
			int X2 = sc.nextInt();
			int Y2 = sc.nextInt();

			int min =Math.min(Math.min(X1, Y1), Math.min(X2,Y2));

			X1 += Math.abs(min);
			Y1 += Math.abs(min);
			X2 += Math.abs(min);
			Y2 += Math.abs(min);

			int max = Math.max(Math.max(X1, Y1),Math.max(X2, Y2));

			boolean[][][] visited = new boolean[max+1][max+1][4];

			ArrayDeque<bfs> dq = new ArrayDeque<>();

			for (int d = 0; d < 4; d++)
				dq.add(new bfs(X1, Y1, d, 0));

			while (!dq.isEmpty()) {
				bfs b = dq.poll();

				if (visited[b.r][b.c][b.d])
					continue;

				visited[b.r][b.c][b.d] = true;

				if ((b.r == X2) && (b.c == Y2)) {
					System.out.printf("#%d %d\n", test_case, b.cnt);
					dq.clear();
					break;
				}

				for (int d = 0; d < 4; d++) {
					int nextr= b.r + ROWS[d];
					int nextc = b.c + COLS[d];

					if ((b.d < 2) && (d < 2))
						continue;
					if ((b.d >= 2) && (d >=2))
						continue;

					if (nextr < 0||nextc < 0 || nextr > max || nextc > max)
						continue;

					if (visited[nextr][nextc][d])
						continue;

					dq.add(new bfs(nextr, nextc, d, b.cnt + 1));
				}
			}
		}
	}
}
