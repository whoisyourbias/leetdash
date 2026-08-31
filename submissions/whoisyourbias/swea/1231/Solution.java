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
	static class Node {
		char v;
		int left;
		int right;
		Node(char v, int left, int right) {
			this.v=v;
			this.left=left;
			this.right=right;
		}
	}

	static Node[] graph;

	public static void main(String args[]) throws Exception
	{
		/*
		   아래의 메소드 호출은 앞으로 표준 입력(키보드) 대신 input.txt 파일로부터 읽어오겠다는 의미의 코드입니다.
		   여러분이 작성한 코드를 테스트 할 때, 편의를 위해서 input.txt에 입력을 저장한 후,
		   이 코드를 프로그램의 처음 부분에 추가하면 이후 입력을 수행할 때 표준 입력 대신 파일로부터 입력을 받아올 수 있습니다.
		   따라서 테스트를 수행할 때에는 아래 주석을 지우고 이 메소드를 사용하셔도 좋습니다.
		   단, 채점을 위해 코드를 제출하실 때에는 반드시 이 메소드를 지우거나 주석 처리 하셔야 합니다.
		 */
		System.setIn(new FileInputStream("input.txt"));

		/*
		   표준입력 System.in 으로부터 스캐너를 만들어 데이터를 읽어옵니다.
		 */
		BufferedReader br=  new BufferedReader(new InputStreamReader(System.in));
		StringTokenizer st;
		int T = 10;

		for(int test_case = 1; test_case <= T; test_case++)
		{
			st = new StringTokenizer(br.readLine());
			int N = Integer.parseInt(st.nextToken());

			graph = new Node[N + 1];
			for (int i = 0; i < N; i++) {
				st = new StringTokenizer(br.readLine());
				int NO = Integer.parseInt(st.nextToken());
				char v = st.nextToken().charAt(0);
				int LEFTNO = -1;
				int RIGHTNO = -1;
				if (st.hasMoreTokens())
					LEFTNO = Integer.parseInt(st.nextToken());
				if (st.hasMoreTokens())
					RIGHTNO = Integer.parseInt(st.nextToken());
				graph[NO] = new Node(v, LEFTNO, RIGHTNO);
			}
			System.out.printf("#%d ", test_case);
			TraverseInorder(graph[1]);
			System.out.println();

		}
	}

	private static void TraverseInorder(Node h) {

		if (h.left != -1)
			TraverseInorder(graph[h.left]);
		System.out.print(h.v);
		if (h.right != -1)
			TraverseInorder(graph[h.right]);
	}
}
