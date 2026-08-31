import java.util.Arrays;
import java.util.HashSet;
import java.util.Scanner;
import java.util.StringTokenizer;
import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStreamReader;

/*
   사용하는 클래스명이 Solution 이어야 하므로, 가급적 Solution.java 를 사용할 것을 권장합니다.
   이러한 상황에서도 동일하게 java Solution 명령으로 프로그램을 수행해볼 수 있습니다.
 */
class Solution
{
	static int[] parent;
	public static void main(String args[]) throws Exception
	{
		BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
		StringTokenizer st = new StringTokenizer(br.readLine());
		int T;
		T=Integer.parseInt(st.nextToken());
		/*
		   여러 개의 테스트 케이스가 주어지므로, 각각을 처리합니다.
		*/

		for(int test_case = 1; test_case <= T; test_case++)
		{
			st = new StringTokenizer(br.readLine());
			int N = Integer.parseInt(st.nextToken());
			int M = Integer.parseInt(st.nextToken());

			parent = new int[N + 1];

			for (int i = 1; i <= N; i++)
				parent[i] = i;
			for (int i = 0; i < M; i++) {
				st = new StringTokenizer(br.readLine());

				int A = Integer.parseInt(st.nextToken());
				int B = Integer.parseInt(st.nextToken());
				
                union(A,B);
			}

			HashSet<Integer> s = new HashSet<>();
			for (int i = 1; i <= N; i++) {
				s.add(getParent(parent[i]));
			}
			System.out.printf("#%d %d\n", test_case, s.size());
		}
	}

	private static int getParent(int x) {
		if (parent[x] == x)
			return x;

		return parent[x] = getParent(parent[x]);
	}

	private static void union(int A, int B) {
		int PA = getParent(A);
		int PB = getParent(B);

		if (PA != PB) {
			parent[PA] = Math.min(PA, PB);
			parent[PB] = Math.min(PA, PB);
		}
	}
}
