import java.util.Scanner;
import java.io.FileInputStream;

class Solution {
	public static void main(String args[]) throws Exception {

		Scanner sc = new Scanner(System.in);
		int T;
		T = sc.nextInt();

		for (int test_case = 1; test_case <= T; test_case++) {
			int N = sc.nextInt();
			int K = sc.nextInt();

			int[][] arr = new int[N][N];

			for (int i = 0; i < N; i++) {
				for (int j = 0; j < N; j++) {
					arr[i][j] = sc.nextInt();
				}
			}

			int count = 0;
			for (int i = 0; i < N; i++) {
				int length = 0;
				for (int j = 0; j < N; j++) {
					if (arr[i][j] == 1) {
						length++;
					} else {
						if (length == K) {
							count++;
						}
						length = 0;
					}
				}
				if (length == K) {
					count++;
				}

			}

			for (int i = 0; i < N; i++) {
				int length = 0;
				for (int j = 0; j < N; j++) {
					if (arr[j][i] == 1) {
						length++;
					} else {
						if (length == K) {
							count++;
						}
						length = 0;
					}

				}
				if (length == K) {
					count++;
				}
			}

			System.out.println("#" + test_case + " " + count);

		}
		sc.close();
	}
}