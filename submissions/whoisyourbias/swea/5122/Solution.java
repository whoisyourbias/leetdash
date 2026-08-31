import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.util.StringTokenizer;
import java.util.Vector;

class Solution {
	public static void main(String[] args) throws Exception {
		System.setIn(new FileInputStream("sample_input.txt"));
		BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
		StringTokenizer st = new StringTokenizer(br.readLine());

		int T = Integer.parseInt(st.nextToken());

		for (int t = 1; t <= T; t++) {
			st = new StringTokenizer(br.readLine());

			int N = Integer.parseInt(st.nextToken());
			int M = Integer.parseInt(st.nextToken());
			int L = Integer.parseInt(st.nextToken());

			int[] arr = new int[N];
			Vector<Integer> vt = new Vector<>();
			st = new StringTokenizer(br.readLine());
			for (int i = 0; i < N; i++) {
				int v = Integer.parseInt(st.nextToken());
				vt.add(v);
				arr[i] = v;
			}

			for (int i = 0; i < M; i++) {
				st = new StringTokenizer(br.readLine());
				String cmd = st.nextToken();

				int idx;
				int number;

				switch (cmd) {
					case "I":
						idx = Integer.parseInt(st.nextToken());
						number = Integer.parseInt(st.nextToken());
						CMDI(vt, idx, number);
						break;
					case "C":
						idx = Integer.parseInt(st.nextToken());
						number = Integer.parseInt(st.nextToken());
						CMDC(vt, idx, number);
						break;
					default:
						idx = Integer.parseInt(st.nextToken());
						CMDD(vt, idx);
				}
			}

			System.out.printf("#%d %d\n", t, L < vt.size() ? vt.get(L) : -1);
		}
	}

	// I 2 7 -> 2번 인덱스 앞에 7을 추가하고, 한 칸 씩 뒤로 이동한다.
	public static void CMDI(Vector<Integer> vt, int idx, int number) {
		vt.insertElementAt(number, idx);
	}

	// C 3 8 -> 3번 인덱스 자리를 8로 바꾼다.
	public static void CMDC(Vector<Integer> vt, int idx, int number) {
		vt.set(idx, number);
	}

	public static void CMDD(Vector<Integer> vt, int idx) {
		vt.remove(idx);
	}
}
